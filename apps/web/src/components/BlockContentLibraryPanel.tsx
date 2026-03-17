import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Paper,
  Button,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../api';

interface BlockContentVariant {
  id: string;
  block_name: string;
  variant_name: string;
  source_project: string;
  preview_html: string;
}

interface Props {
  blockName: string;
  appliedVariantId?: string;
  onApplyVariant: (variantId: string) => void;
  onRemoveVariant: () => void;
}

export default function BlockContentLibraryPanel({ blockName, appliedVariantId, onApplyVariant, onRemoveVariant }: Props) {
  const [variants, setVariants] = useState<BlockContentVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<BlockContentVariant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (blockName) {
      setLoading(true);
      api.getBlockContentVariants(blockName)
        .then(setVariants)
        .finally(() => setLoading(false));
      setSelectedVariant(null);
    }
  }, [blockName]);

  // Basic HTML sanitizer: strips script, iframe, object, embed, and external URLs except data: URIs
  function sanitizeHtml(html: string): string {
    return html
      .replace(/<(script|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<(script|iframe|object|embed)[^>]*>/gi, '')
      .replace(/src\s*=\s*['"](http[s]?:\/\/[^'"]*)['"]/gi, '')
      .replace(/href\s*=\s*['"](http[s]?:\/\/[^'"]*)['"]/gi, '')
      .replace(/on\w+\s*=\s*['"][^'"]*['"]/gi, '')
      .replace(/<\/?(?!p|div|span|h[1-6]|ul|ol|li|table|tr|td|th|strong|em|br)[a-z][^>]*>/gi, '');
  }

  // Find the applied variant's display name for the banner
  const appliedVariant = variants.find(v => v.id === appliedVariantId);

  return (
    <Box sx={{ width: 400, p: 2, borderLeft: 1, borderColor: 'divider', height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" sx={{ mb: appliedVariantId ? 1 : 2 }}>
        Block Content Library
      </Typography>

      {/* Applied variant banner */}
      {appliedVariantId && (
        <Alert
          severity="success"
          sx={{ mb: 2, py: 0.5 }}
          action={
            <IconButton
              size="small"
              color="inherit"
              title="Remove applied variant"
              onClick={onRemoveVariant}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Variant applied</Typography>
          {appliedVariant && (
            <Typography variant="caption" display="block">{appliedVariant.variant_name}</Typography>
          )}
        </Alert>
      )}
      <List>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        {!loading && variants.length === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              No stored variants yet for <strong>{blockName}</strong>.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Use "Ingest Block Content" to import from a previous project DOCX.
              The source file must contain <code>[[BLOCK:{blockName}]]</code> and{' '}
              <code>[[END:{blockName}]]</code> markers.
            </Typography>
            <Box sx={{ mt: 1 }}>
              <Typography
                component="a"
                href="/api/block-content/all"
                target="_blank"
                variant="caption"
                color="primary"
              >
                View all stored content (debug)
              </Typography>
            </Box>
          </Box>
        )}
        {variants.map(variant => (
          <ListItemButton
            key={variant.id}
            selected={selectedVariant?.id === variant.id}
            onClick={() => setSelectedVariant(variant)}
          >
            <ListItemText
              primary={variant.variant_name}
              secondary={`Source: ${variant.source_project}`}
            />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ my: 2 }} />
      {selectedVariant && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Preview
          </Typography>
          <Box sx={{ border: '1px solid #eee', borderRadius: 1, p: 1, bgcolor: 'background.paper', minHeight: 120 }}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedVariant.preview_html) }} />
          </Box>
          <Button
            variant={appliedVariantId === selectedVariant.id ? 'contained' : 'outlined'}
            color={appliedVariantId === selectedVariant.id ? 'success' : 'primary'}
            sx={{ mt: 2 }}
            onClick={() => onApplyVariant(selectedVariant.id)}
          >
            {appliedVariantId === selectedVariant.id ? 'Applied ✓' : 'Use this block'}
          </Button>
        </Paper>
      )}
    </Box>
  );
}
