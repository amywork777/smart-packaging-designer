import { useState } from 'react';
import { RefreshCw, Cube } from 'lucide-react';

interface ProcessResponse {
  success: boolean;
  video_url: string;
  preprocessed_url: string;
  glb_urls: string[];
  timestamp: number;
  userId: string;
}

interface Show3DButtonProps {
  imageUrl: string;
  onVideoGenerated?: (videoUrl: string) => void;
}

export default function Show3DButton({ imageUrl, onVideoGenerated }: Show3DButtonProps) {
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate3D = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/process_3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          userId: 'testUser123',
        }),
      });

      const data: ProcessResponse = await response.json();
      
      if (data.success) {
        setVideoUrl(data.video_url);
        onVideoGenerated?.(data.video_url);
      } else {
        setError('Failed to generate 3D view');
      }
    } catch (err) {
      setError('Error generating 3D view');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={generate3D}
      disabled={loading}
      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Generating 3D...
        </>
      ) : (
        <>
          <Cube className="w-4 h-4" />
          Show in 3D
        </>
      )}
    </button>
  );
} 