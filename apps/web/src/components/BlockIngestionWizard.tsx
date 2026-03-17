import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  TextField,
  Input,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Chip,
} from '@mui/material';

interface IngestionResult {
  block_name: string;
  stored: boolean;
  reason?: string;
  block_content_id?: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

interface IngestApiResponse {
  ingestionId: string;
  results: IngestionResult[];
  parsedCount?: number;       // total blocks found in source DOCX
  skeletonCount?: number;     // total blocks in skeleton
  warnings: string[];
}

interface Props {
  onComplete: () => void;
}

export default function BlockIngestionWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [sourceProject, setSourceProject] = useState('');
  const [variantPrefix, setVariantPrefix] = useState('');
  const [notes, setNotes] = useState('');
  const [results, setResults] = useState<IngestionResult[]>([]);
  const [ingestResponse, setIngestResponse] = useState<IngestApiResponse | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const steps = ['Select File', 'Metadata', 'Ingest', 'Summary'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleIngest = async () => {
    if (!file) return;
    setLoading(true);
    setIngestError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceProject', sourceProject);
    formData.append('variantPrefix', variantPrefix);
    formData.append('notes', notes);
    try {
      const res = await fetch('/api/block-content/ingest', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setIngestError(`Server error ${res.status}: ${(errData as { error?: string }).error ?? res.statusText}`);
        setStep(3);
        setLoading(false);
        return;
      }
      const data: IngestApiResponse = await res.json();
      setIngestResponse(data);
      setResults(data.results || []);
      // Fetch block previews for mapped blocks
      const previewMap: Record<string, string> = {};
      for (const r of data.results || []) {
        if (r.stored && r.block_content_id) {
          const previewRes = await fetch(`/api/block-content/${r.block_content_id}/preview`);
          const previewData = await previewRes.json();
          previewMap[r.block_name] = previewData.preview_html;
        }
      }
      setPreviews(previewMap);
      setStep(2);
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Unknown network error');
      setResults([]);
      setStep(3);
    }
    setLoading(false);
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Block Ingestion Wizard</Typography>
      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {steps.map(label => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>
      {step === 0 && (
        <Box>
          <Input type="file" inputProps={{ accept: '.docx' }} onChange={handleFileChange} />
          <Button sx={{ mt: 2 }} disabled={!file} variant="contained" onClick={() => setStep(1)}>Next</Button>
        </Box>
      )}
      {step === 1 && (
        <Box>
          <TextField label="Source Project" value={sourceProject} onChange={e => setSourceProject(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Variant Prefix" value={variantPrefix} onChange={e => setVariantPrefix(e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Notes" value={notes} onChange={e => setNotes(e.target.value)} fullWidth multiline sx={{ mb: 2 }} />
          <Button variant="outlined" sx={{ mr: 2 }} onClick={() => setStep(0)}>Back</Button>
          <Button variant="contained" disabled={!file || loading} onClick={handleIngest}>Ingest</Button>
        </Box>
      )}
      {step === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>Block Previews & Mapping Adjustments</Typography>
          {/* Summary counts */}
          {(() => {
            const storedCount = results.filter(r => r.stored).length;
            const dupCount = results.filter(r => r.isDuplicate).length;
            const notFoundCount = results.filter(r => !r.stored && !r.isDuplicate).length;
            return (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`${storedCount} stored`} color={storedCount > 0 ? 'success' : 'default'} size="small" />
                {dupCount > 0 && <Chip label={`${dupCount} duplicate`} color="warning" size="small" />}
                {notFoundCount > 0 && <Chip label={`${notFoundCount} not found`} color="error" size="small" />}
              </Box>
            );
          })()}
          {results.filter(r => r.stored).length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No blocks were found in this file. Make sure the source document contains{' '}
              <strong>[[BLOCK:name]]</strong> and <strong>[[END:name]]</strong> markers matching the
              skeleton template. Note: exported/rendered documents have these markers removed.
            </Alert>
          )}
          <List>
            {Object.entries(previews).map(([blockName, html]) => (
              <ListItem key={blockName} alignItems="flex-start">
                <ListItemText
                  primary={blockName}
                  secondary={<div dangerouslySetInnerHTML={{ __html: html }} />}
                />
                {/* Mapping adjustment dropdown (future enhancement) */}
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Button variant="contained" onClick={() => setStep(3)}>Finalize Mapping</Button>
        </Box>
      )}
      {step === 3 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>Summary</Typography>
          {ingestError && (
            <Alert severity="error" sx={{ mb: 2 }}>{ingestError}</Alert>
          )}
          {ingestResponse && (() => {
            const stored = results.filter(r => r.stored);
            const dups = results.filter(r => r.isDuplicate);
            const notFound = results.filter(r => !r.stored && !r.isDuplicate);
            return (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Chip label={`${stored.length} stored`} color={stored.length > 0 ? 'success' : 'default'} />
                  {dups.length > 0 && <Chip label={`${dups.length} duplicate (skipped)`} color="warning" />}
                  {notFound.length > 0 && <Chip label={`${notFound.length} not found in source`} color="error" />}
                </Box>
                {stored.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>Stored blocks:</Typography>
                    <List dense>
                      {stored.map(r => (
                        <ListItem key={r.block_name}>
                          <ListItemText primary={r.block_name} primaryTypographyProps={{ color: 'success.main' }} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
                {dups.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>Duplicates skipped:</Typography>
                    <List dense>
                      {dups.map(r => (
                        <ListItem key={r.block_name}>
                          <ListItemText primary={r.block_name} secondary={r.reason} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
                {notFound.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mt: 1, color: 'text.secondary' }}>
                      Not found in source ({notFound.length}):
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {notFound.map(r => r.block_name).join(', ')}
                    </Typography>
                  </>
                )}
              </Box>
            );
          })()}
          {!ingestResponse && !ingestError && (
            <List>
              {results.map(r => (
                <ListItem key={r.block_name}>
                  <ListItemText
                    primary={r.block_name}
                    secondary={r.stored ? 'Stored' : r.reason || 'Skipped'}
                  />
                </ListItem>
              ))}
            </List>
          )}
          <Divider sx={{ my: 2 }} />
          <Button variant="outlined" sx={{ mr: 2 }} onClick={() => { setStep(0); setResults([]); setIngestResponse(null); setIngestError(null); setPreviews({}); }}>Ingest Another</Button>
          <Button variant="contained" onClick={onComplete}>Done</Button>
        </Box>
      )}
    </Paper>
  );
}
