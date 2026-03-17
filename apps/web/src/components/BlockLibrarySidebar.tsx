import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Switch,
  InputAdornment,
  Divider,
  Collapse,
} from '@mui/material';
import { Search as SearchIcon, ExpandMore, ExpandLess } from '@mui/icons-material';
import { BlockLibraryEntry, BlockStatus, BlockState } from '../api';

const STATE_COLOR: Record<BlockState, 'default' | 'warning' | 'success'> = {
  Complete: 'success',
  Partial: 'warning',
  Empty: 'default',
};

const CATEGORY_ORDER = ['Core', 'Design', 'Systems', 'Project', 'Annexes'] as const;

interface Props {
  blockLibrary: BlockLibraryEntry[];
  blockStatuses: Record<string, BlockStatus>;
  blocks: Record<string, boolean>;
  selectedBlock: string | null;
  onSelectBlock: (name: string) => void;
  onToggleBlock: (name: string, enabled: boolean) => void;
}

export default function BlockLibrarySidebar({
  blockLibrary,
  blockStatuses,
  blocks,
  selectedBlock,
  onSelectBlock,
  onToggleBlock,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return blockLibrary.filter(
      b => b.title.toLowerCase().includes(q) || b.category.toLowerCase().includes(q),
    );
  }, [blockLibrary, search]);

  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, BlockLibraryEntry[]>>((acc, entry) => {
        if (!acc[entry.category]) acc[entry.category] = [];
        acc[entry.category].push(entry);
        return acc;
      }, {}),
    [filtered],
  );

  const categories = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
      const bi = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);

      const aKnown = ai !== -1;
      const bKnown = bi !== -1;

      if (aKnown && bKnown) return ai - bi;
      if (aKnown) return -1;
      if (bKnown) return 1;
      return a.localeCompare(b);
    });
  }, [grouped]);

  return (
    <Box
      sx={{
        width: 280,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search */}
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search blocks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Category groups */}
      <List dense sx={{ flexGrow: 1, overflowY: 'auto', py: 0 }}>
        {categories.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              No blocks match your search
            </Typography>
          </Box>
        )}

        {categories.map(cat => {
          const isOpen = collapsed[cat] !== true;
          return (
            <Box key={cat}>
              <ListItemButton
                onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
                sx={{ py: 0.5, bgcolor: 'grey.100' }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      textTransform="uppercase"
                      letterSpacing={0.8}
                    >
                      {cat}
                    </Typography>
                  }
                />
                {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </ListItemButton>

              <Collapse in={isOpen}>
                {grouped[cat].map(entry => {
                  const status = blockStatuses[entry.name];
                  const enabled = blocks[entry.name] !== false;
                  const selected = selectedBlock === entry.name;

                  return (
                    <ListItemButton
                      key={entry.name}
                      selected={selected}
                      onClick={() => onSelectBlock(entry.name)}
                      sx={{ pl: 2, pr: 0.5, py: 0.5 }}
                    >
                      <ListItemText
                        primary={entry.title}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                        {status && (
                          <Chip
                            label={status.state}
                            size="small"
                            color={STATE_COLOR[status.state]}
                            sx={{
                              height: 18,
                              fontSize: 10,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                        <Switch
                          size="small"
                          checked={enabled}
                          onChange={e => {
                            e.stopPropagation();
                            onToggleBlock(entry.name, e.target.checked);
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </Box>
                    </ListItemButton>
                  );
                })}
              </Collapse>
              <Divider />
            </Box>
          );
        })}
      </List>
    </Box>
  );
}
