import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Switch,
  Divider,
} from '@mui/material';

interface BlocksTabProps {
  blocks: Record<string, boolean>;
  availableBlocks: string[];
  onChange: (blocks: Record<string, boolean>) => void;
}

export default function BlocksTab({ blocks, availableBlocks, onChange }: BlocksTabProps) {
  const handleToggle = (blockName: string) => {
    onChange({
      ...blocks,
      [blockName]: !blocks[blockName],
    });
  };

  if (availableBlocks.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          No blocks defined in the template
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Toggle sections on/off to include or exclude them from the final document
      </Typography>

      <List>
        {availableBlocks.map((blockName, index) => (
          <Box key={blockName}>
            <ListItem
              secondaryAction={
                <Switch
                  edge="end"
                  checked={blocks[blockName] !== false}
                  onChange={() => handleToggle(blockName)}
                />
              }
            >
              <ListItemText
                primary={blockName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                secondary={blocks[blockName] !== false ? 'Included' : 'Excluded'}
              />
            </ListItem>
            {index < availableBlocks.length - 1 && <Divider />}
          </Box>
        ))}
      </List>
    </Box>
  );
}
