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
import GlobalFieldSearch from '../components/GlobalFieldSearch';


export default function DraftEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [blocks, setBlocks] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<Record<string, Record<string, string>[]>>({});
  const [lastFileId, setLastFileId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

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

  // Fetch block statuses for this draft (completion / enabled state)
  const { data: blockStatusList = [] } = useQuery({
    queryKey: ['blockStatus', id],
    queryFn: () => api.getBlockStatus(id!),
    enabled: !!id,
    refetchInterval: 0, // only refetch after save
  });

  // O(1) status lookups keyed by block name
  const blockStatuses = useMemo(
    () =>
      Object.fromEntries(blockStatusList.map(s => [s.name, s])) as Record<string, BlockStatus>,
    [blockStatusList],
  );

  // Update local state when draft loads
  useEffect(() => {
    if (draft) {
      setDraftName(draft.name);
      setBlocks(draft.data.blocks);
      setValues(draft.data.values);
      setTables(draft.data.tables);
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
      await api.updateDraft(id!, { blocks, values, tables });
      if (draftName !== draft?.name) {
        await api.updateDraftName(id!, draftName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', id] });
      queryClient.invalidateQueries({ queryKey: ['blockStatus', id] });
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

  /** Clear all fields and table rows that belong to a given block */
  const handleClearBlock = (blockName: string) => {
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

        {/* Right: Field search + Block editor */}
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
