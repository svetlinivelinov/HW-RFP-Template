import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { api } from '../api';

export default function DraftsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDraftName, setNewDraftName] = useState('');

  // Fetch drafts
  const { data: drafts, isLoading, error } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => api.getDrafts(),
  });

  // Create draft mutation
  const createMutation = useMutation({
    mutationFn: (name: string) => api.createDraft(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      setCreateDialogOpen(false);
      setNewDraftName('');
      navigate(`/draft/${data.id}`);
    },
  });

  // Delete draft mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });

  const handleCreateDraft = () => {
    if (newDraftName.trim()) {
      createMutation.mutate(newDraftName.trim());
    }
  };

  const handleDeleteDraft = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this draft?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Document Drafts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Draft
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load drafts: {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : drafts && drafts.length > 0 ? (
        <Paper>
          <List>
            {drafts.map((draft, index) => (
              <ListItem
                key={draft.id}
                divider={index < drafts.length - 1}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={(e) => handleDeleteDraft(e, draft.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
                disablePadding
              >
                <ListItemButton onClick={() => navigate(`/draft/${draft.id}`)}>
                  <ListItemText
                    primary={draft.name}
                    secondary={`Last updated: ${new Date(draft.updated_at).toLocaleString()}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No drafts yet. Create your first draft to get started.
          </Typography>
        </Paper>
      )}

      {/* Create Draft Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create New Draft</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Draft Name"
            fullWidth
            variant="outlined"
            value={newDraftName}
            onChange={(e) => setNewDraftName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateDraft();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateDraft}
            variant="contained"
            disabled={!newDraftName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
