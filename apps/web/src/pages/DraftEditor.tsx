import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  AppBar,
  Toolbar,
  IconButton,
  CircularProgress,
  Alert,
  TextField,
  Container,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { api, BlockStatus } from '../api';
import BlockLibrarySidebar from '../components/BlockLibrarySidebar';
import BlockEditorPanel from '../components/BlockEditorPanel';
import BlockContentLibraryPanel from '../components/BlockContentLibraryPanel';
import GlobalFieldSearch from '../components/GlobalFieldSearch';
import BlockIngestionWizard from '../components/BlockIngestionWizard';


export default function DraftEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [blocks, setBlocks] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<Record<string, Record<string, string>[]>>({});
  const [blockVariants, setBlockVariants] = useState<Record<string, string>>({});
  const [lastFileId, setLastFileId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [contentLibraryKey, setContentLibraryKey] = useState(0);

  // Fetch draft
  const { data: draft, isLoading: draftLoading, error: draftError } = useQuery({
    queryKey: ['draft', id],
    queryFn: () => api.getDraft(id!),
    enabled: !!id,
  });

  // Fetch template manifest
  const { data: manifest, isLoading: manifestLoading } = useQuery({
    queryKey: ['manifest'],
    queryFn: () => api.getTemplateManifest(),
  });

  // Fetch block library (merged parsed + DB overrides)
  const { data: blockLibrary = [] } = useQuery({
    queryKey: ['blockLibrary'],
    queryFn: () => api.getBlockLibrary(),
  });

  // Compute statuses from local editor state so badges/toggles stay in sync with unsaved edits.
  const blockStatuses = useMemo(() => {
    const byName: Record<string, BlockStatus> = {};

    for (const entry of blockLibrary) {
      const enabled = blocks[entry.name] !== false;
      const totalItems = entry.fieldsUsed.length + entry.tablesUsed.length;

      let filledItems = 0;
      for (const field of entry.fieldsUsed) {
        if ((values[field] ?? '').trim() !== '') {
          filledItems++;
        }
      }
      for (const table of entry.tablesUsed) {
        if (Array.isArray(tables[table]) && tables[table].length > 0) {
          filledItems++;
        }
      }

      const hasVariant = Boolean(blockVariants[entry.name]);

      let state: BlockStatus['state'];
      let completionPercent: number;

      if (hasVariant) {
        completionPercent = 100;
        state = 'Complete';
      } else if (totalItems === 0) {
        completionPercent = 100;
        state = enabled ? 'Complete' : 'Empty';
      } else {
        completionPercent = Math.round((filledItems / totalItems) * 100);
        if (filledItems === 0) state = 'Empty';
        else if (filledItems < totalItems) state = 'Partial';
        else state = 'Complete';
      }

      byName[entry.name] = {
        name: entry.name,
        enabled,
        completionPercent,
        state,
      };
    }

    return byName;
  }, [blockLibrary, blocks, values, tables, blockVariants]);

  // Update local state when draft loads
  useEffect(() => {
    if (draft) {
      setDraftName(draft.name);
      setBlocks(draft.data.blocks);
      setValues(draft.data.values);
      setTables(draft.data.tables);
      setBlockVariants(draft.data.blockVariants ?? {});
    }
  }, [draft]);

  // Auto-select first block when library loads and nothing is selected
  useEffect(() => {
    if (!selectedBlock && blockLibrary.length > 0) {
      setSelectedBlock(blockLibrary[0].name);
    }
  }, [blockLibrary, selectedBlock]);

  // Save mutation — also refreshes block-status badges
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.updateDraft(id!, { blocks, values, tables, blockVariants });
      if (draftName !== draft?.name) {
        await api.updateDraftName(id!, draftName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', id] });
      setHasChanges(false);
    },
  });

  // Render (export DOCX) mutation
  const renderMutation = useMutation({
    mutationFn: () => api.renderDraft(id!),
    onSuccess: (data) => {
      setLastFileId(data.fileId);
      window.location.href = api.getDownloadUrl(data.fileId);
    },
  });

  const handleSave = () => saveMutation.mutate();

  const handleExport = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Save before exporting?')) {
        saveMutation.mutate(undefined, { onSuccess: () => renderMutation.mutate() });
      } else {
        renderMutation.mutate();
      }
    } else {
      renderMutation.mutate();
    }
  };

  const updateValues = (newValues: Record<string, string>) => {
    setValues(newValues);
    setHasChanges(true);
  };

  const updateTables = (newTables: Record<string, Record<string, string>[]>) => {
    setTables(newTables);
    setHasChanges(true);
  };

  const handleToggleBlock = (name: string, enabled: boolean) => {
    setBlocks(prev => ({ ...prev, [name]: enabled }));
    setHasChanges(true);
  };

  const handleApplyVariant = async (blockName: string, variantId: string) => {
    await api.applyBlockVariant(id!, blockName, variantId);
    setBlockVariants(prev => ({ ...prev, [blockName]: variantId }));
  };

  /** Clear all fields, table rows, and applied block variant for a given block */
  const handleClearBlock = async (blockName: string) => {
    const entry = blockLibrary.find(e => e.name === blockName);
    if (!entry) return;

    const newValues = { ...values };
    for (const field of entry.fieldsUsed) {
      newValues[field] = '';
    }
    const newTables = { ...tables };
    for (const table of entry.tablesUsed) {
      newTables[table] = [];
    }
    setValues(newValues);
    setTables(newTables);

    // Remove the applied block variant immediately (null signals deletion to the server)
    if (blockVariants[blockName]) {
      setBlockVariants(prev => {
        const next = { ...prev };
        delete next[blockName];
        return next;
      });
      await api.updateDraft(id!, { blockVariants: { [blockName]: null } });
    }

    setHasChanges(true);
  };

  if (draftLoading || manifestLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (draftError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load draft:{' '}
          {draftError instanceof Error ? draftError.message : 'Unknown error'}
        </Alert>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Drafts
        </Button>
      </Container>
    );
  }

  if (!draft || !manifest) return null;

  const selectedEntry = blockLibrary.find(e => e.name === selectedBlock) ?? null;
  const selectedStatus = selectedBlock ? (blockStatuses[selectedBlock] ?? null) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Ingestion Wizard button */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Button variant="contained" color="secondary" onClick={() => setShowWizard(true)}>
          Ingest Block Content
        </Button>
      </Box>
      {/* Ingestion Wizard modal */}
      {showWizard && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', bgcolor: 'rgba(0,0,0,0.2)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BlockIngestionWizard onComplete={() => { setShowWizard(false); setContentLibraryKey(k => k + 1); }} />
          <Button sx={{ position: 'absolute', top: 24, right: 24 }} variant="outlined" onClick={() => setShowWizard(false)}>Close</Button>
        </Box>
      )}
      {/* Top AppBar */}
      <AppBar position="static" sx={{ flexShrink: 0 }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <TextField
            value={draftName}
            onChange={e => {
              setDraftName(e.target.value);
              setHasChanges(true);
            }}
            variant="standard"
            InputProps={{ style: { color: 'white', fontSize: '1.25rem' } }}
            sx={{ flexGrow: 1 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            {hasChanges && (
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Unsaved changes
              </Typography>
            )}
            <Button
              color="inherit"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saveMutation.isPending || !hasChanges}
            >
              Save
            </Button>
            <Button
              color="inherit"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={renderMutation.isPending}
            >
              Export DOCX
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Error banners */}
      {(saveMutation.isError || renderMutation.isError) && (
        <Box sx={{ flexShrink: 0, px: 2, pt: 1 }}>
          {saveMutation.isError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Save failed:{' '}
              {saveMutation.error instanceof Error ? saveMutation.error.message : 'Unknown error'}
            </Alert>
          )}
          {renderMutation.isError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Export failed:{' '}
              {renderMutation.error instanceof Error
                ? renderMutation.error.message
                : 'Unknown error'}
            </Alert>
          )}
        </Box>
      )}

      {/* Main content: Sidebar + Editor */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Left: Block Library Sidebar */}
        <BlockLibrarySidebar
          blockLibrary={blockLibrary}
          blockStatuses={blockStatuses}
          blocks={blocks}
          selectedBlock={selectedBlock}
          onSelectBlock={setSelectedBlock}
          onToggleBlock={handleToggleBlock}
        />

        {/* Center: Field search + Block editor */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Global field search */}
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
            <GlobalFieldSearch
              blockLibrary={blockLibrary}
              onSelectBlock={setSelectedBlock}
            />
          </Box>

          {/* Block editor panel */}
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            <BlockEditorPanel
              selectedEntry={selectedEntry}
              blockStatus={selectedStatus}
              values={values}
              tables={tables}
              manifest={manifest}
              onValuesChange={updateValues}
              onTablesChange={updateTables}
              onClearBlock={handleClearBlock}
            />
          </Box>
        </Box>

        {/* Right: Block Content Library Panel */}
        {selectedBlock && (
          <BlockContentLibraryPanel
            key={`${selectedBlock}-${contentLibraryKey}`}
            blockName={selectedBlock}
            appliedVariantId={blockVariants[selectedBlock]}
            onApplyVariant={variantId => handleApplyVariant(selectedBlock, variantId)}
            onRemoveVariant={() => handleClearBlock(selectedBlock)}
          />
        )}
      </Box>

      {/* Export success toast */}
      {lastFileId && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1400 }}>
          <Alert
            severity="success"
            onClose={() => setLastFileId(null)}
            action={
              <Button size="small" href={api.getDownloadUrl(lastFileId)}>
                Download Again
              </Button>
            }
          >
            Document exported successfully!
          </Alert>
        </Box>
      )}
    </Box>
  );
}
