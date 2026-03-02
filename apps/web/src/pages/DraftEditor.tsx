import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { api } from '../api';
import BlocksTab from '../components/BlocksTab';
import FieldsTab from '../components/FieldsTab';
import TablesTab from '../components/TablesTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function DraftEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState(0);
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

  // Update local state when draft loads
  useEffect(() => {
    if (draft) {
      setDraftName(draft.name);
      setBlocks(draft.data.blocks);
      setValues(draft.data.values);
      setTables(draft.data.tables);
    }
  }, [draft]);

  // Save draft mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.updateDraft(id!, { blocks, values, tables });
      if (draftName !== draft?.name) {
        await api.updateDraftName(id!, draftName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', id] });
      setHasChanges(false);
    },
  });

  // Render mutation
  const renderMutation = useMutation({
    mutationFn: () => api.renderDraft(id!),
    onSuccess: (data) => {
      setLastFileId(data.fileId);
      // Auto-download
      window.location.href = api.getDownloadUrl(data.fileId);
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleExport = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Save before exporting?')) {
        saveMutation.mutate(undefined, {
          onSuccess: () => {
            renderMutation.mutate();
          },
        });
      } else {
        renderMutation.mutate();
      }
    } else {
      renderMutation.mutate();
    }
  };

  const updateBlocks = (newBlocks: Record<string, boolean>) => {
    setBlocks(newBlocks);
    setHasChanges(true);
  };

  const updateValues = (newValues: Record<string, string>) => {
    setValues(newValues);
    setHasChanges(true);
  };

  const updateTables = (newTables: Record<string, Record<string, string>[]>) => {
    setTables(newTables);
    setHasChanges(true);
  };

  const updateDraftName = (name: string) => {
    setDraftName(name);
    setHasChanges(true);
  };

  if (draftLoading || manifestLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (draftError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Failed to load draft: {draftError instanceof Error ? draftError.message : 'Unknown error'}
        </Alert>
        <Button onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Drafts
        </Button>
      </Container>
    );
  }

  if (!draft || !manifest) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <TextField
            value={draftName}
            onChange={(e) => updateDraftName(e.target.value)}
            variant="standard"
            InputProps={{
              style: { color: 'white', fontSize: '1.25rem' },
            }}
            sx={{ flexGrow: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
            {hasChanges && (
              <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1 }}>
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

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        {saveMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to save: {saveMutation.error instanceof Error ? saveMutation.error.message : 'Unknown error'}
          </Alert>
        )}
        {renderMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to export: {renderMutation.error instanceof Error ? renderMutation.error.message : 'Unknown error'}
          </Alert>
        )}

        <Paper>
          <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
            <Tab label="Blocks" />
            <Tab label="Fields" />
            <Tab label="Tables" />
          </Tabs>

          <TabPanel value={currentTab} index={0}>
            <BlocksTab
              blocks={blocks}
              availableBlocks={manifest.blocks}
              onChange={updateBlocks}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <FieldsTab
              values={values}
              availablePlaceholders={manifest.placeholders}
              onChange={updateValues}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <TablesTab
              tables={tables}
              availableTables={manifest.tables}
              onChange={updateTables}
            />
          </TabPanel>
        </Paper>

        {lastFileId && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Document exported successfully!{' '}
            <Button size="small" href={api.getDownloadUrl(lastFileId)}>
              Download Again
            </Button>
          </Alert>
        )}
      </Container>
    </Box>
  );
}
