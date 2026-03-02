import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Grid,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';

interface FieldsTabProps {
  values: Record<string, string>;
  availablePlaceholders: string[];
  onChange: (values: Record<string, string>) => void;
}

export default function FieldsTab({ values, availablePlaceholders, onChange }: FieldsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleValueChange = (key: string, value: string) => {
    onChange({
      ...values,
      [key]: value,
    });
  };

  // Group placeholders by prefix (text before first underscore)
  const groupedPlaceholders = availablePlaceholders.reduce((acc, placeholder) => {
    const prefix = placeholder.includes('_') ? placeholder.split('_')[0] : 'Other';
    if (!acc[prefix]) {
      acc[prefix] = [];
    }
    acc[prefix].push(placeholder);
    return acc;
  }, {} as Record<string, string[]>);

  // Filter based on search term
  const filteredGroups = Object.entries(groupedPlaceholders).reduce((acc, [prefix, fields]) => {
    const filtered = fields.filter(field =>
      field.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[prefix] = filtered;
    }
    return acc;
  }, {} as Record<string, string[]>);

  if (availablePlaceholders.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No placeholders defined in the template
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        fullWidth
        placeholder="Search fields..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm('')}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {Object.entries(filteredGroups).map(([prefix, fields]) => (
        <Paper key={prefix} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {prefix.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Typography>
          <Grid container spacing={2}>
            {fields.map((field) => (
              <Grid item xs={12} sm={6} key={field}>
                <TextField
                  fullWidth
                  label={field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  value={values[field] || ''}
                  onChange={(e) => handleValueChange(field, e.target.value)}
                  variant="outlined"
                  size="small"
                />
              </Grid>
            ))}
          </Grid>
        </Paper>
      ))}

      {Object.keys(filteredGroups).length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">
            No fields match your search
          </Typography>
        </Box>
      )}
    </Box>
  );
}
