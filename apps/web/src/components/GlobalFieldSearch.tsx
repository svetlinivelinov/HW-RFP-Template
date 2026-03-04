import { useState, useMemo, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
  Chip,
  ClickAwayListener,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { BlockLibraryEntry } from '../api';

interface SearchHit {
  field: string;
  blockName: string;
  blockTitle: string;
  blockCategory: string;
}

interface Props {
  blockLibrary: BlockLibraryEntry[];
  onSelectBlock: (blockName: string) => void;
}

export default function GlobalFieldSearch({ blockLibrary, onSelectBlock }: Props) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchHit[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const hits: SearchHit[] = [];
    for (const entry of blockLibrary) {
      for (const field of entry.fieldsUsed) {
        if (field.toLowerCase().includes(q)) {
          hits.push({
            field,
            blockName: entry.name,
            blockTitle: entry.title,
            blockCategory: entry.category,
          });
        }
      }
    }
    return hits.slice(0, 20);
  }, [search, blockLibrary]);

  const handleSelect = (hit: SearchHit) => {
    onSelectBlock(hit.blockName);
    setSearch('');
    setOpen(false);
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative' }}>
        <TextField
          inputRef={inputRef}
          size="small"
          fullWidth
          placeholder="Search fields across all blocks…"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {open && search.trim() && (
          <Paper
            elevation={4}
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1300,
              maxHeight: 300,
              overflowY: 'auto',
              mt: 0.5,
            }}
          >
            {results.length > 0 ? (
              <List dense disablePadding>
                {results.map(hit => (
                  <ListItemButton
                    key={`${hit.blockName}::${hit.field}`}
                    onClick={() => handleSelect(hit)}
                  >
                    <ListItemText
                      primary={hit.field
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())}
                      secondary={`{{${hit.field}}}`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25, ml: 1 }}>
                      <Chip label={hit.blockTitle} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                      <Typography variant="caption" color="text.secondary">
                        {hit.blockCategory}
                      </Typography>
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No fields matching "{search}"
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
}
