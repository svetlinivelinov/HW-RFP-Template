import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Button,
  TextField,
  Paper,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ClearAll as ClearAllIcon } from '@mui/icons-material';
import { BlockLibraryEntry, BlockState, BlockStatus, TemplateManifest } from '../api';

const STATE_COLOR: Record<BlockState, 'default' | 'warning' | 'success'> = {
  Complete: 'success',
  Partial: 'warning',
  Empty: 'default',
};

interface Props {
  selectedEntry: BlockLibraryEntry | null;
  blockStatus: BlockStatus | null;
  values: Record<string, string>;
  tables: Record<string, Record<string, string>[]>;
  manifest: TemplateManifest;
  onValuesChange: (values: Record<string, string>) => void;
  onTablesChange: (tables: Record<string, Record<string, string>[]>) => void;
  onClearBlock: (blockName: string) => void;
}

export default function BlockEditorPanel({
  selectedEntry,
  blockStatus,
  values,
  tables,
  manifest,
  onValuesChange,
  onTablesChange,
  onClearBlock,
}: Props) {
  if (!selectedEntry) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Select a block from the sidebar to edit its content
        </Typography>
      </Box>
    );
  }

  const handleFieldChange = (field: string, value: string) => {
    onValuesChange({ ...values, [field]: value });
  };

  const handleAddRow = (tableName: string) => {
    const columns = manifest.tables[tableName] ?? [];
    const newRow = Object.fromEntries(columns.map(c => [c, '']));
    onTablesChange({ ...tables, [tableName]: [...(tables[tableName] ?? []), newRow] });
  };

  const handleRemoveRow = (tableName: string, rowIndex: number) => {
    onTablesChange({
      ...tables,
      [tableName]: (tables[tableName] ?? []).filter((_, i) => i !== rowIndex),
    });
  };

  const handleCellChange = (tableName: string, rowIndex: number, col: string, value: string) => {
    const rows = [...(tables[tableName] ?? [])];
    rows[rowIndex] = { ...rows[rowIndex], [col]: value };
    onTablesChange({ ...tables, [tableName]: rows });
  };

  const hasContent =
    selectedEntry.fieldsUsed.length > 0 || selectedEntry.tablesUsed.length > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Block header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" lineHeight={1.3}>
              {selectedEntry.title}
            </Typography>
            {selectedEntry.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {selectedEntry.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            <Chip label={selectedEntry.category} size="small" variant="outlined" />
            {blockStatus && (
              <Chip
                label={`${blockStatus.state} — ${blockStatus.completionPercent}%`}
                size="small"
                color={STATE_COLOR[blockStatus.state]}
              />
            )}
          </Box>
        </Box>
        {blockStatus && blockStatus.completionPercent > 0 && blockStatus.completionPercent < 100 && (
          <LinearProgress
            variant="determinate"
            value={blockStatus.completionPercent}
            sx={{ mt: 1, borderRadius: 1 }}
          />
        )}
      </Box>

      {/* Scrollable content */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {!hasContent ? (
          <Alert severity="info">
            This block has no tracked placeholders or tables. Toggle it on/off using the sidebar.
          </Alert>
        ) : (
          <>
            {/* Fields */}
            {selectedEntry.fieldsUsed.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                  Fields
                </Typography>
                <Grid container spacing={2}>
                  {selectedEntry.fieldsUsed.map(field => (
                    <Grid item xs={12} sm={6} key={field}>
                      <TextField
                        fullWidth
                        label={field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        value={values[field] ?? ''}
                        onChange={e => handleFieldChange(field, e.target.value)}
                        variant="outlined"
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Tables */}
            {selectedEntry.tablesUsed.map(tableName => {
              const columns = manifest.tables[tableName] ?? [];
              const rows = tables[tableName] ?? [];

              return (
                <Box key={tableName} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Table:{' '}
                    {tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddRow(tableName)}
                    sx={{ mb: 1 }}
                  >
                    Add Row
                  </Button>

                  {rows.length > 0 ? (
                    <Paper variant="outlined" sx={{ overflow: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {columns.map(col => (
                              <TableCell key={col}>
                                {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </TableCell>
                            ))}
                            <TableCell />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row, ri) => (
                            <TableRow key={ri}>
                              {columns.map(col => (
                                <TableCell key={col}>
                                  <TextField
                                    size="small"
                                    fullWidth
                                    value={row[col] ?? ''}
                                    onChange={e =>
                                      handleCellChange(tableName, ri, col, e.target.value)
                                    }
                                    variant="standard"
                                  />
                                </TableCell>
                              ))}
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveRow(tableName, ri)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Paper>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No rows yet. Click "Add Row" to get started.
                    </Typography>
                  )}
                </Box>
              );
            })}
          </>
        )}
      </Box>

      {/* Footer: Clear Block */}
      {hasContent && (
        <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<ClearAllIcon />}
            onClick={() => onClearBlock(selectedEntry.name)}
          >
            Clear Block Data
          </Button>
        </Box>
      )}
    </Box>
  );
}
