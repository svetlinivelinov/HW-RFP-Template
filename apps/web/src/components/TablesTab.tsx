import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

interface TablesTabProps {
  tables: Record<string, Record<string, string>[]>;
  availableTables: Record<string, string[]>;
  onChange: (tables: Record<string, Record<string, string>[]>) => void;
}

export default function TablesTab({ tables, availableTables, onChange }: TablesTabProps) {
  const [expandedTable, setExpandedTable] = useState<string | false>(false);

  const handleAddRow = (tableName: string) => {
    const columns = availableTables[tableName] || [];
    const newRow = columns.reduce((acc, col) => {
      acc[col] = '';
      return acc;
    }, {} as Record<string, string>);

    onChange({
      ...tables,
      [tableName]: [...(tables[tableName] || []), newRow],
    });
  };

  const handleRemoveRow = (tableName: string, rowIndex: number) => {
    const currentRows = tables[tableName] || [];
    onChange({
      ...tables,
      [tableName]: currentRows.filter((_, i) => i !== rowIndex),
    });
  };

  const handleCellChange = (tableName: string, rowIndex: number, column: string, value: string) => {
    const currentRows = [...(tables[tableName] || [])];
    currentRows[rowIndex] = {
      ...currentRows[rowIndex],
      [column]: value,
    };

    onChange({
      ...tables,
      [tableName]: currentRows,
    });
  };

  const tableNames = Object.keys(availableTables);

  if (tableNames.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No tables defined in the template
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Edit table data that will be populated in the document
      </Typography>

      {tableNames.map((tableName) => {
        const columns = availableTables[tableName] || [];
        const rows = tables[tableName] || [];

        return (
          <Accordion
            key={tableName}
            expanded={expandedTable === tableName}
            onChange={(_, isExpanded) => setExpandedTable(isExpanded ? tableName : false)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>
                {tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                ({rows.length} row{rows.length !== 1 ? 's' : ''})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ width: '100%' }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => handleAddRow(tableName)}
                  sx={{ mb: 2 }}
                  variant="outlined"
                  size="small"
                >
                  Add Row
                </Button>

                {rows.length > 0 ? (
                  <Paper variant="outlined" sx={{ overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {columns.map((column) => (
                            <TableCell key={column}>
                              {column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </TableCell>
                          ))}
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {columns.map((column) => (
                              <TableCell key={column}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={row[column] || ''}
                                  onChange={(e) =>
                                    handleCellChange(tableName, rowIndex, column, e.target.value)
                                  }
                                  variant="standard"
                                />
                              </TableCell>
                            ))}
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveRow(tableName, rowIndex)}
                                color="error"
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
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
