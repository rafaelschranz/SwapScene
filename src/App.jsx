import { useState, useRef, useEffect } from 'react';

const BACKGROUND_COLOR = '#66a6d7';
const OUTPUT_SIZE = 500;

function App() {
  const [processedImage, setProcessedImage] = useState(null);
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
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    setError(null);
    setProcessedImage(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      processImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (imageSrc) => {
    setIsProcessing(true);
    setProgress('Preparing AI model...');
    setProgressPercent(0);
    setError(null);

    try {
      const { removeBackground } = await import('@imgly/background-removal');

      const blob = await removeBackground(imageSrc, {
        progress: (key, current, total) => {
          const percent = Math.round((current / total) * 100);
          if (key.includes('fetch')) {
            setProgress(`Downloading model... ${percent}%`);
            // Map fetch progress to 0-40% of the bar
            setProgressPercent(Math.min(40, Math.round(0.4 * percent)));
          } else if (key.includes('inference')) {
            setProgress(`Processing image... ${percent}%`);
            // Map inference progress to 40-100% of the bar
            setProgressPercent(40 + Math.round(0.6 * percent));
          }
        }
      });

      const cutoutUrl = URL.createObjectURL(blob);
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

        setProcessedImage(canvas.toDataURL('image/png'));
        setIsProcessing(false);
        setProgressPercent(100);
        URL.revokeObjectURL(cutoutUrl);
      };

      cutoutImg.onerror = () => {
        setError('Could not process image');
        setIsProcessing(false);
        setProgressPercent(0);
        URL.revokeObjectURL(cutoutUrl);
      };

      cutoutImg.src = cutoutUrl;

    } catch (err) {
      console.error('Error:', err);
      setError('Could not remove background. Please try another image.');
      setIsProcessing(false);
      setProgressPercent(0);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.download = `portraitstudio-${Date.now()}.png`;
    link.href = processedImage;
    link.click();
  };

  const handleReset = () => {
    setProcessedImage(null);
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
          <p style={{ color: '#6b7280' }}>Remove backgrounds instantly with AI</p>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>Upload Image</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>Select a portrait photo to remove the background</p>

          {!processedImage && !isProcessing && (
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
                  <span style={{ fontWeight: '600' }}>Click to upload</span> or drag & drop
                </p>
                <p style={{ color: '#9ca3af', fontSize: '12px' }}>PNG, JPG or WEBP</p>
              </div>
              <input
                id="file-upload"
                type="file"
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

          {processedImage && !isProcessing && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <img
                  src={processedImage}
                  alt="Processed result"
                  style={{ borderRadius: '8px', border: '1px solid #e5e7eb', maxWidth: '100%' }}
                />
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
                  ⬇️ Download
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
                  🔄 New Image
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px', color: '#9ca3af', fontSize: '12px' }}>
          <span>🔒</span>
          <span>All processing happens locally in your browser</span>
        </div>
      </div>
    </div>
  );
}

export default App;
