import { useState, useRef, useEffect } from 'react';

const BACKGROUND_COLOR = '#66a6d7';
const OUTPUT_SIZE = 500;

function App() {
  const [processedImages, setProcessedImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Preload the (small, faster) background removal model in the background
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        if (cancelled) return;
        // Trigger a tiny no-op run to warm up the default, higher-quality model
        const tinyPixel = new Uint8ClampedArray([0, 0, 0, 0]);
        const tinyCanvas = document.createElement('canvas');
        tinyCanvas.width = 1;
        tinyCanvas.height = 1;
        const tinyCtx = tinyCanvas.getContext('2d');
        const tinyImageData = new ImageData(tinyPixel, 1, 1);
        tinyCtx.putImageData(tinyImageData, 0, 0);
        await removeBackground(tinyCanvas.toDataURL('image/png'), {
          rescale: true,
        });
      } catch {
        // Ignore warm-up errors; real processing will handle failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (!imageFiles.length) {
      setError('Bitte laden Sie mindestens eine gültige Bilddatei hoch');
      return;
    }

    setError(null);
    setProcessedImages([]);

    setIsProcessing(true);
    setProgress('KI-Modell wird vorbereitet...');
    setProgressPercent(0);

    try {
      const total = imageFiles.length;
      const results = [];

      for (let index = 0; index < total; index++) {
        const file = imageFiles[index];

        const imageSrc = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
          reader.readAsDataURL(file);
        });

        setProgress(`Bild ${index + 1} von ${total} wird verarbeitet...`);

        const outputDataUrl = await processImage(imageSrc, (key, current, totalSteps) => {
          let stepProgress = current / totalSteps;
          // The library reports two stages: fetching and inference
          // We can weigh them 50/50 for the progress of a single image
          if (key.includes('fetch')) {
            stepProgress = stepProgress * 0.5;
          } else if (key.includes('inference')) {
            stepProgress = 0.5 + stepProgress * 0.5;
          }

          const imageProgress = stepProgress;
          const overallProgress = ((index + imageProgress) / total) * 100;
          setProgressPercent(Math.min(100, overallProgress));
        });

        results.push({
          id: `${Date.now()}-${index}`,
          name: file.name,
          dataUrl: outputDataUrl,
        });
      }

      setProcessedImages(results);
      setIsProcessing(false);
      setProgress('Alle Bilder erfolgreich verarbeitet');
      setProgressPercent(100);
    } catch (err) {
      console.error('Error while processing images:', err);
      setError('Ein oder mehrere Bilder konnten nicht verarbeitet werden. Bitte versuchen Sie es erneut.');
      setIsProcessing(false);
      setProgressPercent(0);
    }
  };

  const processImage = async (imageSrc, onInternalProgress) => {
    try {
      const { removeBackground } = await import('@imgly/background-removal');

      const blob = await removeBackground(imageSrc, {
        progress: (key, current, total) => {
          if (onInternalProgress) {
            onInternalProgress(key, current, total);
          }
        }
      });

      const cutoutUrl = URL.createObjectURL(blob);

      const outputDataUrl = await new Promise((resolve, reject) => {
        const cutoutImg = new Image();

        cutoutImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = OUTPUT_SIZE;
          canvas.height = OUTPUT_SIZE;
          const ctx = canvas.getContext('2d');

          ctx.fillStyle = BACKGROUND_COLOR;
          ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

          const cutoutAspect = cutoutImg.width / cutoutImg.height;
          let cutoutWidth, cutoutHeight, cutoutX, cutoutY;

          if (cutoutAspect > 1) {
            cutoutHeight = OUTPUT_SIZE;
            cutoutWidth = OUTPUT_SIZE * cutoutAspect;
          } else {
            cutoutWidth = OUTPUT_SIZE;
            cutoutHeight = OUTPUT_SIZE / cutoutAspect;
          }

          cutoutX = (OUTPUT_SIZE - cutoutWidth) / 2;
          cutoutY = (OUTPUT_SIZE - cutoutHeight) / 2;

          ctx.drawImage(cutoutImg, cutoutX, cutoutY, cutoutWidth, cutoutHeight);

          resolve(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(cutoutUrl);
        };

        cutoutImg.onerror = () => {
          URL.revokeObjectURL(cutoutUrl);
          reject(new Error('Bild konnte nicht verarbeitet werden'));
        };

        cutoutImg.src = cutoutUrl;
      });

      return outputDataUrl;
    } catch (err) {
      console.error('Error:', err);
      setError('Hintergrund konnte nicht entfernt werden. Bitte versuchen Sie es erneut.');
      throw err;
    }
  };

  const handleDownload = () => {
    if (!processedImages.length) return;

    processedImages.forEach((image, index) => {
      const link = document.createElement('a');
      link.download = `portraitstudio-${index + 1}-${Date.now()}.png`;
      link.href = image.dataUrl;
      link.click();
    });
  };

  const handleReset = () => {
    setProcessedImages([]);
    setError(null);
    setProgress('');
    setProgressPercent(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '48px 16px' }}>
      <div style={{ maxWidth: '512px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>📸 PortraitStudio</h1>
          <p style={{ color: '#6b7280' }}>Hintergründe sofort mit KI entfernen</p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Bild hochladen</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>Wählen Sie ein oder mehrere Porträtfotos aus, um den Hintergrund zu entfernen</p>

          {processedImages.length === 0 && !isProcessing && (
            <label
              htmlFor="file-upload"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '192px',
                border: '2px dashed #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>📤</div>
                <p style={{ color: '#6b7280', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600' }}>Zum Hochladen klicken</span> oder per Drag & Drop
                </p>
                <p style={{ color: '#9ca3af', fontSize: '12px' }}>PNG, JPG oder WEBP</p>
              </div>
              <input
                id="file-upload"
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </label>
          )}

          {isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '192px' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⏳</div>
              <p style={{ color: '#6b7280', marginBottom: '12px' }}>{progress}</p>
              <div style={{ width: '100%', maxWidth: '320px' }}>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '9999px',
                    backgroundColor: '#e5e7eb',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      backgroundColor: '#3b82f6',
                      transition: 'width 0.2s ease-out',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginTop: '16px' }}>
              <p style={{ color: '#dc2626', fontSize: '14px' }}>{error}</p>
            </div>
          )}

          {processedImages.length > 0 && !isProcessing && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {processedImages.map((image) => (
                  <div key={image.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={image.dataUrl}
                      alt={image.name || 'Processed result'}
                      style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '100%' }}
                    />
                    <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', wordBreak: 'break-word' }}>{image.name}</p>
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleDownload}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  ⬇️ Alle herunterladen
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🔄 Neue Bilder
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px', color: '#9ca3af', fontSize: '12px' }}>
          <span>🔒</span>
          <span>Die gesamte Verarbeitung findet lokal in Ihrem Browser statt</span>
        </div>
      </div>
    </div>
  );
}

export default App;
