'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand, Upload, PenTool, Type, Download, Cog, Clock, ChevronRight, Edit, Loader2, History, X, FileText, Info, Package, Palette, RefreshCw, ChevronDown, ChevronUp, Check, Lock } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { useDesignStore } from '@/lib/store/designs';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import Link from 'next/link';
import { put } from '@vercel/blob';
import { AnalysisData } from '@/types/analysis';
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { ManufacturingRecommendations } from '@/components/ManufacturingRecommendations';
import { DesignFeeSection } from '@/components/DesignFeeSection';
import { SIZES } from '@/lib/types/sizes';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const PROGRESS_STEPS = [
  {
    id: 1,
    name: 'Design Details',
    description: 'Enter product specifications',
    icon: Package
  },
  {
    id: 2,
    name: 'Manufacturing Method',
    description: 'Choose production method',
    icon: Cog
  },
  {
    id: 3,
    name: 'Review & Submit',
    description: 'Confirm and place order',
    icon: FileText
  }
];

const scaleToLog = (value: number): number => {
  // Convert linear 0-100 to logarithmic 1-10000
  return Math.round(Math.exp(Math.log(10000) * (value / 100)));
};

const scaleToLinear = (value: number): number => {
  // Convert logarithmic 1-10000 to linear 0-100
  return Math.round((Math.log(value) / Math.log(10000)) * 100);
};

const FALLBACK_IMAGE = '/placeholder-image.jpg'; // You'll need to add a placeholder image to your public folder

type InputMethod = 'text' | 'upload';

async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Create a regular HTML Image element
      const img = document.createElement('img');
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Fill white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate dimensions to maintain aspect ratio
        const scale = Math.min(256 / img.width, 256 / img.height);
        const x = (256 - img.width * scale) / 2;
        const y = (256 - img.height * scale) / 2;

        // Draw image
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        resolve(canvas.toDataURL('image/png', 1.0));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Add these types at the top of your file or in a separate types file
interface EditHistoryEntry {
  originalImage: string;
  newImage: string;
  description: string;
  changes: string;
  timestamp: string;
  designId: string; // Reference to the design document
}

interface Design {
  id: string;
  title: string;
  images: string[];
  createdAt: string;
  prompt: string;
  originalDesignId?: string;
  editHistory?: EditHistoryEntry[];
  threeDData?: {
    videoUrl: string;
    glbUrls: string[];
    preprocessedUrl: string;
    timestamp: number;
  };
}

const generateDesignTitle = (prompt: string): string => {
  // Extract key product terms from the prompt
  const words = prompt.toLowerCase().split(' ');
  const productWords = words.filter(word => 
    !['a', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with'].includes(word)
  );
  
  // Capitalize first letter of each word
  const title = productWords
    .slice(0, 3) // Take first 3 significant words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return title || 'Untitled Design';
};

// Add this type for dimensions
interface Dimensions {
  size?: SizeType;
  unit: 'inches';
}

// Add this interface for tracking image states
interface ImageState {
  loading: boolean;
  error: boolean;
}

const MATERIAL_OPTIONS = [
  {
    title: "PLA",
    description: "Basic plastic filament, easy to print, most common and cost-effective.",
    cost: "$ (Most Affordable)"
  },
  {
    title: "Wood PLA",
    description: "Regular PLA mixed with wood particles for natural look.",
    cost: "$$ (Mid-Range)"
  },
  {
    title: "TPU",
    description: "Flexible, squishy rubber-like material that can bend.",
    cost: "$$ (Mid-Range)"
  },
  {
    title: "Resin",
    description: "Liquid that cures into solid, gives smoothest finish, provides high detail.",
    cost: "$$$ (Premium)"
  },
  {
    title: "Aluminum",
    description: "High-quality metal that provides an elegant look.",
    cost: "$$$$ (Premium)"
  }
];

// Add manufacturing methods constant
const MANUFACTURING_METHODS = [
  {
    title: "FDM 3D Printing",
    description: "Standard 3D printing, great for most designs",
    recommended: false
  },
  {
    title: "SLS 3D Printing",
    description: "Professional-grade powder printing",
    recommended: false
  },
  {
    title: "Resin 3D Printing",
    description: "High-detail resin printing",
    recommended: false
  }
];

const getRecommendedMethod = (quantity: number, description: string = ''): string => {
  const desc = description.toLowerCase();
  
  // Extract key information from the description
  const needsDetail = desc.includes('detail') || desc.includes('smooth') || desc.includes('fine');
  const needsStrength = desc.includes('strong') || desc.includes('durable') || desc.includes('functional');
  const isComplex = desc.includes('complex') || desc.includes('intricate');
  
  // Decision tree based on requirements
  if (needsDetail && quantity <= 50) {
    return "Resin 3D Printing";
  }
  if ((needsStrength || isComplex) && quantity <= 200) {
    return "SLS 3D Printing";
  }
  // Default to FDM for most cases
  return "FDM 3D Printing";
};

// Add this helper function to get recommended materials
const getRecommendedMaterials = (quantity: number, productType: string = ''): string[] => {
  const type = productType.toLowerCase();
  
  // For detailed parts
  if (type.includes('detail') || type.includes('smooth')) {
    return ["Standard Resin", "Clear Resin"];
  }
  
  // For strong/durable parts
  if (type.includes('strong') || type.includes('durable')) {
    return ["Nylon", "Carbon Fiber Nylon"];
  }
  
  // For flexible parts
  if (type.includes('flexible') || type.includes('bendable')) {
    return ["TPU", "Flexible Resin"];
  }
  
  // Default to common materials
  return ["PLA", "PETG"];
};

// Add this helper function to convert blob URL to base64
const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Headings
const headingStyles = {
  h1: "text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent", // Main title
  h2: "text-2xl font-semibold text-gray-800", // Section titles
  h3: "text-lg font-semibold text-gray-800", // Sub-section titles
  h4: "text-base font-medium text-gray-800" // Component titles
};

// Body text
const textStyles = {
  primary: "text-base text-gray-700", // Main content text
  secondary: "text-sm text-gray-600", // Secondary information
  small: "text-xs text-gray-500" // Helper text, labels
};

// Add style options
const STYLE_OPTIONS = [
  {
    id: 'cartoon',
    name: 'Cartoon',
    description: 'Adorable chibi character'
  },
  {
    id: 'realistic',
    name: 'Realistic',
    description: 'Photorealistic portrait'
  },
  {
    id: 'geometric',
    name: 'Geometric',
    description: 'Modern polygon sculpture'
  }
];

// Add this interface at the top of the file
interface GenerateResponse {
  success: boolean;
  imageUrl?: string;
  prompt?: string;
  error?: string;
}

const handleGenerateDesign = async () => {
  try {
    setIsLoading(true);
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: designPrompt,
        mode: 'generate',
        style: currentStyle,
        userId: session?.user?.id // Add this line
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate design');
    }

    const data = await response.json();
    
    if (!data.success || !data.imageUrl) {
      throw new Error('Failed to generate design');
    }

    setCurrentDesign({
      id: data.designId,
      imageUrl: data.imageUrl,
      prompt: designPrompt
    });

    toast({
      title: "Success",
      description: "Design generated and saved successfully"
    });

  } catch (error) {
    console.error('Generation error:', error);
    toast({
      variant: "destructive",
      title: "Error",
      description: error instanceof Error ? error.message : 'Failed to generate design'
    });
  } finally {
    setIsLoading(false);
  }
};

// Add this constant for style prompts
const STYLE_PROMPTS: Record<string, string> = {
  cartoon: "Create in a cute, stylized cartoon style with clean lines and vibrant colors",
  realistic: "Generate a photorealistic 3D render with detailed textures and physically accurate materials",
  geometric: "Design using clean geometric shapes and minimal modern style"
};

// Add these constants near the top of the file with other constants
const PRICING = {
  Mini: { PLA: 20, Wood: 40, TPU: 45, Resin: 60, Aluminum: 200 },
  Small: { PLA: 35, Wood: 55, TPU: 60, Resin: 80, Aluminum: 'contact us' },
  Medium: { PLA: 60, Wood: 125, TPU: 150, Resin: 200, Aluminum: 'contact us' },
  Large: { PLA: 'contact us', Wood: 'contact us', TPU: 'contact us', Resin: 'contact us', Aluminum: 'contact us' }
} as const;

const DELIVERY_ESTIMATES = {
  Mini: { PLA: '< 2 weeks', Wood: '< 2 weeks', TPU: '< 2 weeks', Resin: '< 2 weeks' },
  Small: { PLA: '< 2 weeks', Wood: '< 3 weeks', TPU: '< 3 weeks', Resin: '< 2 weeks' },
  Medium: { PLA: '< 2 weeks', Wood: '< 3 weeks', TPU: '< 3 weeks', Resin: '< 2 weeks' },
  Large: { PLA: '< 1 month', Wood: '< 1 month', TPU: '< 3 weeks', Resin: '< 2 weeks' }
} as const;

// Add this helper function
const getPriceAndDelivery = (size: string, material: string) => {
  const materialKey = material.replace(' PLA', '') as keyof typeof PRICING.Mini;
  const sizeKey = size as keyof typeof PRICING;
  
  const price = PRICING[sizeKey]?.[materialKey];
  const delivery = DELIVERY_ESTIMATES[sizeKey]?.[materialKey];
  
  return { price, delivery };
};

// Add this helper function near other utility functions
const getMaterialRecommendation = async (imageUrl: string) => {
  try {
    // If the image is a blob URL, convert it to base64
    let processedImageUrl = imageUrl;
    if (imageUrl.startsWith('blob:')) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      processedImageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    const response = await fetch('/api/analyze-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: processedImageUrl })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze design');
    }

    const data = await response.json();
    if (!data.recommendedMaterial || !data.reason) {
      throw new Error('Invalid response from material analysis');
    }

    return data;
  } catch (error) {
    console.error('Error getting material recommendation:', error);
    throw error instanceof Error ? error : new Error('Failed to analyze design');
  }
};

// Add this function near other utility functions
const analyzeImageForEdit = async (imageUrl: string) => {
  try {
    console.log('Starting design analysis...');
    const response = await fetch('/api/analyze-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Analysis failed:', errorData);
      throw new Error(errorData.error || 'Failed to analyze design');
    }

    const data = await response.json();
    if (!data.description) {
      console.error('No description in response:', data);
      throw new Error('Invalid analysis response');
    }

    console.log('Analysis successful:', data.description.substring(0, 100) + '...');
    return data.description;
  } catch (error) {
    console.error('Error analyzing image:', error);
    toast({
      variant: "destructive",
      title: "Analysis Failed",
      description: error instanceof Error ? error.message : "Failed to analyze design"
    });
    throw error;
  }
};

// Add this component near the top of your file
const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-square bg-gray-200 rounded-lg mb-4" />
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
  </div>
);

// Update the Process3DResponse interface
interface Process3DResponse {
  success: boolean;
  status: string;
  video_url?: string;
  preprocessed_url?: string;
  glb_urls?: string[];
  timestamp: number;
  userId: string;
}

// Add these constants at the top of the file
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export default function LandingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [textPrompt, setTextPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { designs, addDesign, clearDesigns, updateDesign, getUserDesigns } = useDesignStore();
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('FDM 3D Printing');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const { data: session, status } = useSession();
  const userDesigns = session?.user?.id 
    ? getUserDesigns(session.user.id) 
    : getUserDesigns('anonymous'); // Get anonymous designs if not logged in
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [hasUsedFreeDesign, setHasUsedFreeDesign] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions>({
    size: undefined,
    unit: 'inches'
  });
  const [dimensionsError, setDimensionsError] = useState<string | null>(null);
  const [showDesignFee, setShowDesignFee] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("Standard PLA"); // Set PLA as default
  const [isEditingDimensions, setIsEditingDimensions] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [designComments, setDesignComments] = useState('');
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [inspirationImages, setInspirationImages] = useState<string[]>([]);
  const MAX_INSPIRATION_IMAGES = 3;
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [recommendationInfo, setRecommendationInfo] = useState<{
    material: string;
    reason: string;
  } | null>(null);
  const [isDesignFinalized, setIsDesignFinalized] = useState(false);
  // Add this ref at the top of your component
  const analysisRef = useRef<HTMLDivElement>(null);
  // Add this at the top of your component with other state declarations
  const [scrollToAnalysis, setScrollToAnalysis] = useState(false);
  // Add these states at the top with other state declarations
  const [processing3D, setProcessing3D] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleImageError = (imageUrl: string) => (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    setImageStates(prev => ({
      ...prev,
      [imageUrl]: { loading: false, error: true }
    }));
    img.src = '';
  };

  const handleImageLoad = (imageUrl: string) => () => {
    setImageStates(prev => ({
      ...prev,
      [imageUrl]: { loading: false, error: false }
    }));
  };

  const validateDimensions = () => {
    if (!dimensions.size) {
      setDimensionsError('Please select a size');
      return false;
    }
    setDimensionsError(null);
    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        setLoading(true);
        const file = files[0];

        // Convert to base64
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to convert file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Save to Firebase first
        const userId = session?.user?.id || 'anonymous';
        const savedDesign = await saveDesignToFirebase({
          imageUrl: base64Image,
          prompt: 'User uploaded design',
          userId,
          mode: 'uploaded'
        });

        // Create new design for local store
        const newDesign = {
          id: savedDesign.id,
          title: 'Uploaded Design',
          images: [savedDesign.imageUrl],
          createdAt: new Date().toISOString(),
          prompt: ''
        };

        // Add to local store
        addDesign(newDesign, userId);
        
        // Update UI
        setSelectedDesign(savedDesign.imageUrl);
        setShowAnalysis(true);
        setScrollToAnalysis(true);

        toast({
          title: "Success",
          description: "Design uploaded successfully!"
        });
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload image"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      try {
        setLoading(true);
        const file = files[0];

        if (!file.type.startsWith('image/')) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Please upload an image file"
          });
          return;
        }

        // Convert to base64
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to convert file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Save to Firebase first
        const userId = session?.user?.id || 'anonymous';
        const savedDesign = await saveDesignToFirebase({
          imageUrl: base64Image,
          prompt: 'User uploaded design',
          userId,
          mode: 'uploaded'
        });

        // Create new design for local store
        const newDesign = {
          id: savedDesign.id,
          title: 'Uploaded Design',
          images: [savedDesign.imageUrl],
          createdAt: new Date().toISOString(),
          prompt: ''
        };

        // Add to local store
        addDesign(newDesign, userId);
        
        // Update UI
        setSelectedDesign(savedDesign.imageUrl);
        setShowAnalysis(true);
        setScrollToAnalysis(true);

        toast({
          title: "Success",
          description: "Design uploaded successfully!"
        });
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload image"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGenerateClick = async () => {
    if (!textPrompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a description"
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: textPrompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to generate image');
      }

      const result = await response.json();
      
      if (result?.imageUrl) {
        // Create new design
        const newDesign = {
          id: Date.now().toString(),
          title: textPrompt ? generateDesignTitle(textPrompt) : 'New Design',
          images: [result.imageUrl],
          createdAt: new Date().toISOString(),
          prompt: textPrompt
        };

        // Add to design store
        const userId = session?.user?.id || 'anonymous';
        addDesign(newDesign, userId);
        
        setSelectedDesign(result.imageUrl);
        setShowAnalysis(true);

        toast({
          title: "Success",
          description: "Design generated successfully!"
        });
      }
    } catch (error) {
      console.error('Generation failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate design"
      });
    } finally {
      setGenerating(false);
    }
  };

  const getPromptForMethod = async () => {
    if (inputMethod === 'text') {
      return { prompt: BASE_SETTINGS + textPrompt };
    }

    if (!uploadedFile || !imagePreview) {
      throw new Error('Please upload an image first');
    }

    try {
      // First analyze the uploaded image
      const visionResponse = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imagePreview,
          additionalDetails: textPrompt 
        }),
      });

      const visionData = await visionResponse.json();

      if (!visionResponse.ok || !visionData.success) {
        throw new Error(visionData.error || 'Failed to analyze image');
      }

      // Save the reference image
      referenceImage = imagePreview;
      
      // Create prompt combining vision analysis and user modifications
      basePrompt = `${BASE_SETTINGS} Based on this reference image showing ${visionData.description}. ${
        textPrompt ? `Modify it by: ${textPrompt}` : 'Enhance the design while maintaining its core features.'
      }`;

    } catch (error) {
      console.error('Image analysis failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze image. Please try again."
      });
      setGenerating(false);
      return;
    }
  };

  const saveImages = async (images: string[]) => {
    if (process.env.NODE_ENV === 'development') {
      // For development, just return the base64 images
      console.warn('Running in development mode - skipping Blob storage');
      return images;
    }

    // Production code
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
      }

      const uploadPromises = images.map(async (imageData) => {
        const blob = await put(`generated-${Date.now()}.png`, imageData, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN
        });
        return blob.url;
      });

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error saving images:', error);
      throw new Error('Failed to save images. Please check your storage configuration.');
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      // If it's a blob URL, convert it to base64 first
      let downloadUrl = imageUrl;
      if (imageUrl.startsWith('blob:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        downloadUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch('/api/download-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: downloadUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to download image');
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-design.png';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error downloading image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download image"
      });
    }
  };

  // Main edit design handler
  const handleEditDesign = async () => {
    if (!selectedDesign || !editPrompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please describe the changes you want to make"
      });
      return;
    }
    
    setIsEditing(true);
    try {
      // First analyze the current design
      const description = await analyzeImageForEdit(selectedDesign);
      console.log('Original design analysis:', description);
      
      // Create a prompt that combines the analysis and edit request
      const editRequest = `3D model design: ${description}. Modification: ${editPrompt.trim()}`;
      console.log('Edit request:', editRequest);

      // Call the API to generate edited design
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'edit',
          prompt: editRequest,
          image: selectedDesign,
          style: selectedStyle
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit design');
      }

      const data = await response.json();
      if (!data.success || !data.imageUrl) {
        throw new Error('Failed to generate edited image');
      }

      // Save the edited design to Firebase
      const userId = session?.user?.id || 'anonymous';
      const currentDesign = designs.find(d => d.images.includes(selectedDesign));
      if (!currentDesign) return;

      // Save edited version with reference
      const savedDesign = await saveDesignToFirebase({
        imageUrl: data.imageUrl,
        prompt: editRequest,
        userId,
        mode: 'edited',
        originalDesignId: currentDesign.id // Clear reference to original
      });

      console.log('Edited design saved to Firebase:', savedDesign);

      // Create a new design entry instead of updating the existing one
      const newDesign = {
        id: savedDesign.id,
        title: 'Edited Design',
        images: [savedDesign.imageUrl],
        createdAt: new Date().toISOString(),
        prompt: editRequest,
        originalDesignId: selectedDesign, // Reference to the original design
        editHistory: [{
          originalImage: selectedDesign,
          newImage: savedDesign.imageUrl,
          description: description,
          changes: editPrompt,
          timestamp: new Date().toISOString()
        }]
      };

      // Add the new design to the store
      addDesign(newDesign, userId);
      
      // Update selected design and UI states
      setSelectedDesign(savedDesign.imageUrl);
      setShowEditDialog(false);
      setEditPrompt('');
      
      // Reset analysis states since this is a new version
      setIsDesignFinalized(false);
      setRecommendationInfo(null);
      setSelectedMaterial('');
      
      toast({
        title: "Success",
        description: "New design version created successfully!"
      });

    } catch (error) {
      console.error('Error editing design:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update design"
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleManufacturingCheckout = (designId: string) => {
    const design = designs.find(d => d.id === designId);
    if (design?.analysis) {
      updateDesign(designId, {
        analysis: {
          ...design.analysis,
          status: 'checkout'
        }
      });
      
      // Navigate to checkout or show checkout modal
      // ... implement checkout flow
    }
  };

  const handleRevertToVersion = (originalImage: string, versionUrl: string) => {
    const designToUpdate = designs.find(d => 
      d.images.includes(originalImage)
    );

    if (designToUpdate) {
      // Keep the existing analysis when switching versions
      const currentAnalysis = designToUpdate.analysis || {
        description: '',
        recommendedMethod: '',
        recommendedMaterials: []
      };

      // Update versions
      const updatedVersions = {
        ...designToUpdate.imageVersions,
        [originalImage]: {
          history: [...(designToUpdate.imageVersions?.[originalImage]?.history || []), originalImage].filter(v => v !== versionUrl),
          current: versionUrl
        }
      };

      // Create a new design object with the updated version and preserved analysis
      const updatedDesign = {
        ...designToUpdate,
        images: [versionUrl, ...designToUpdate.images.filter(img => img !== originalImage)],
        imageVersions: updatedVersions,
        analysis: currentAnalysis // Preserve the existing analysis
      };

      // Update the design in the store
      updateDesign(designToUpdate.id, updatedDesign);

      // Update UI state
      setSelectedDesign(versionUrl);
      setShowVersionHistory(false);
      
      // Update manufacturing recommendations based on the preserved analysis
      if (currentAnalysis) {
        const recommendedMethod = getRecommendedMethod(quantity, currentAnalysis.description);
        setSelectedMethod(recommendedMethod);
        
        const recommendedMaterials = getRecommendedMaterials(quantity, currentAnalysis.description);
        if (recommendedMaterials.length > 0) {
          setSelectedMaterial(recommendedMaterials[0]);
        }
      }

      toast({
        title: "Success",
        description: "Reverted to previous version while maintaining analysis"
      });
    }
  };

  const determineRecommendedMethod = (analysis: any, volume: number) => {
    if (!analysis) return '3D Printing';
    
    const { complexity = '', features = [], dimensions = {}, category = '' } = analysis;
    
    // High volume always prefers injection molding or die casting for suitable materials
    if (volume > 1000) {
      if (category === 'mechanical' || features.includes('metal')) {
        return 'Die Casting';
      }
      return 'Injection Molding';
    }
    
    // Check for flat objects
    if (features.includes('flat') || dimensions.height < 5) {
      return 'Laser Cutting';
    }
    
    // Low volume + complex geometry = 3D printing
    if (volume <= 100 && (complexity === 'high' || features.includes('organic'))) {
      return '3D Printing';
    }
    
    // Check for precision requirements
    if (category === 'mechanical' || features.includes('precision')) {
      return 'CNC Machining';
    }
    
    // Default to 3D printing for prototypes and small runs
    return '3D Printing';
  };

  const handleProceed = async () => {
    if (!selectedMethod || !selectedMaterial) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a material before proceeding"
      });
      return;
    }

    try {
      // Create order with selected method and material
      const order = {
        designId: selectedDesign,
        manufacturingMethod: selectedMethod,
        material: selectedMaterial,
        dimensions,
      };
      
      // Implement payment logic here
      
      toast({
        title: "Success",
        description: "Payment processed successfully. Our team will contact you shortly."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Payment failed. Please try again."
      });
    }
  };

  const handleDimensionsDetected = (detectedDimensions: Dimensions | undefined) => {
    if (detectedDimensions) {
      setDimensions(prev => ({
        ...prev,
        length: detectedDimensions.length || prev.length,
        width: detectedDimensions.width || prev.width,
        height: detectedDimensions.height || prev.height,
        // Keep existing unit if dimensions are detected
        unit: prev.unit
      }));
    }
  };

  const analyzeImage = async () => {
    if (!selectedDesign) return;
    
    setIsUpdatingPlan(true);
    try {
      // Make sure we have base64 data
      const imageData = selectedDesign.startsWith('blob:') 
        ? await blobUrlToBase64(selectedDesign)
        : selectedDesign;

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imageData,
          prompt: "Analyze this product design in one sentence:\n" +
                  "What is this product and what is it made of (metal, plastic, etc)?",
          model: 'gpt-4o'
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      // Structure the analysis data
      const analysisData = {
        description: data.description || "Simple product design",
        recommendedMethod: getRecommendedMethod(quantity, data.description),
        recommendedMaterials: getRecommendedMaterials(quantity, data.description)
      };

      // Update the design store with analysis
      const design = designs.find(d => d.images.includes(selectedDesign));
      if (design) {
        updateDesign(design.id, {
          analysis: analysisData
        });

        // Set recommended manufacturing method
        setSelectedMethod(analysisData.recommendedMethod);
      }

      return analysisData;
    } catch (error) {
      throw error;
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedDesign) return;
    
    setIsUpdatingPlan(true);
    try {
      // Debug log
      console.log('Selected design:', selectedDesign);

      // Make sure we have base64 data
      let imageData;
      try {
        imageData = selectedDesign.startsWith('blob:') 
          ? await blobUrlToBase64(selectedDesign)
          : selectedDesign;
        
        // Debug log
        console.log('Image data type:', typeof imageData);
        console.log('Image data starts with:', imageData.substring(0, 50));
      } catch (error) {
        console.error('Error converting image:', error);
        throw new Error('Failed to process image data');
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Add cache control
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ 
          imageUrl: imageData,
          prompt: "Analyze this product design in one sentence:\n" +
                  "What is this product and what is it made of (metal, plastic, etc)?",
          model: 'gpt-4o'
        }),
      });

      // Debug log
      console.log('Response status:', response.status);
      
      // Get the raw text first to debug
      const rawText = await response.text();
      console.log('Raw response:', rawText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        console.error('Failed to parse response as JSON:', error);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      // Get recommendations based on quantity and product description
      const recommendedMethod = getRecommendedMethod(quantity, data.description);
      const recommendedMaterials = getRecommendedMaterials(quantity, data.description);

      // Update the design with analysis results
      const design = designs.find(d => d.images.includes(selectedDesign));
      if (design) {
        updateDesign(design.id, {
          analysis: {
            description: data.description || "Simple product design",
            recommendedMethod: recommendedMethod,
            recommendedMaterials: recommendedMaterials
          }
        });
      }

      // Update the UI
      setSelectedMethod(recommendedMethod);
      
      // Find and update the recommended method in MANUFACTURING_METHODS
      const methodDetails = MANUFACTURING_METHODS.find(m => m.title === recommendedMethod);
      if (methodDetails) {
        methodDetails.recommended = true;
        // Auto-select the first recommended material if available
        if (recommendedMaterials.length > 0) {
          setSelectedMaterial(recommendedMaterials[0]);
        }
        // Reset other methods' recommended status
        MANUFACTURING_METHODS.forEach(m => {
          if (m.title !== recommendedMethod) {
            m.recommended = false;
          }
        });
      }

      toast({
        title: "Success",
        description: "Manufacturing analysis complete"
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze design. Please try again."
      });
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Update the useEffect to handle material recommendations
  useEffect(() => {
    if (selectedDesign && designs.find(d => d.images.includes(selectedDesign))) {
      const design = designs.find(d => d.images.includes(selectedDesign));
      const description = design?.analysis?.description || '';
      const newRecommendedMethod = getRecommendedMethod(quantity, description);
      const newRecommendedMaterials = getRecommendedMaterials(quantity, description);
      
      setSelectedMethod(newRecommendedMethod);
      
      // Auto-select the first recommended material
      if (newRecommendedMaterials.length > 0) {
        setSelectedMaterial(newRecommendedMaterials[0]);
      }
    }
  }, [quantity, selectedDesign, designs]);

  const handleGenerateManufacturingPlan = async () => {
    if (!validateDimensions()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter valid dimensions"
      });
      return;
    }

    try {
      setIsUpdatingPlan(true);

      const selectedDesignData = designs.find(d => d.images.includes(selectedDesign));
      if (!selectedDesignData) {
        throw new Error('Design not found');
      }

      // Create manufacturing plan data
      const manufacturingPlan = {
        designId: selectedDesignData.id,
        material: selectedMaterial,
        quantity: quantity,
        dimensions: dimensions,
        designComments: designComments
      };

      // Update the design store
      updateDesign(selectedDesignData.id, {
        ...selectedDesignData,
        manufacturingPlan
      });

      toast({
        title: "Success",
        description: "Manufacturing plan generated successfully!"
      });

      setCurrentStep(currentStep + 1);

    } catch (error) {
      console.error('Error generating manufacturing plan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate manufacturing plan"
      });
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleAnalysisComplete = (analysisData: any, designId?: string) => {
    setAnalysisResults(analysisData);
    setIsAnalyzing(false);

    // If designId is provided, update the design's manufacturing option
    if (designId) {
      const design = designs.find(d => d.id === designId);
      if (design) {
        updateDesign(designId, {
          manufacturingOption: analysisData.selectedOption ? {
            name: analysisData.selectedOption.name,
            description: analysisData.selectedOption.description,
            setup: analysisData.selectedOption.costs.setup,
            perUnit: analysisData.selectedOption.costs.perUnit,
            leadTime: analysisData.selectedOption.leadTime
          } : undefined
        });

        // Set the recommended material
        if (analysisData.recommendedMaterials?.length > 0) {
          setSelectedMaterial(analysisData.recommendedMaterials[0]);
        }
      }
    }
  };

  const handleRedoAnalysis = async () => {
    if (!selectedDesign) return;

    setIsAnalyzing(true);
    try {
      // If selectedDesign is a blob URL or base64, use it directly
      let imageData = selectedDesign;
      if (selectedDesign.startsWith('blob:')) {
        const response = await fetch(selectedDesign);
        const blob = await response.blob();
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imageData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }
      
      // Update the design with the new analysis
      const currentDesign = designs.find(d => d.images.includes(selectedDesign));
      if (currentDesign) {
        const updatedAnalysis = {
          productDescription: data.description,
          dimensions: dimensions,
          manufacturingOptions: [],
          status: 'analyzed' as const,
          features: data.features,
          recommendedMethod: data.recommendedMethod,
          recommendedMaterials: data.recommendedMaterials
        };

        updateDesign(currentDesign.id, {
          analysis: updatedAnalysis
        });

        // Auto-select the recommended method
        setSelectedMethod(data.recommendedMethod);
        
        // Auto-select the first recommended material if available
        if (data.recommendedMaterials && data.recommendedMaterials.length > 0) {
          setSelectedMaterial(data.recommendedMaterials[0]);
        }
      }

      handleAnalysisComplete(data);

      toast({
        title: "Success",
        description: "Design analyzed successfully"
      });

    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze design"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update the effect that loads stored analysis
  useEffect(() => {
    if (selectedDesign) {
      const currentDesign = designs.find(d => d.images.includes(selectedDesign));
      
      // Reset states for new design selection
      setIsDesignFinalized(false);
      setRecommendationInfo(null);
      setSelectedMaterial('');
      setDimensions({ size: undefined, unit: 'inches' });
      setQuantity(1);
      setDesignComments('');

      // Only restore states if this design has been previously analyzed
      if (currentDesign?.analysis?.isFinalized && 
          currentDesign.analysis.recommendedMaterial && 
          currentDesign.analysis.reason) {
        setIsDesignFinalized(true);
        setRecommendationInfo({
          material: currentDesign.analysis.recommendedMaterial,
          reason: currentDesign.analysis.reason
        });
        setSelectedMaterial(currentDesign.analysis.recommendedMaterial);
        
        // Restore other states if they exist
        if (currentDesign.analysis.dimensions) {
          setDimensions(currentDesign.analysis.dimensions);
        }
        if (currentDesign.analysis.quantity) {
          setQuantity(currentDesign.analysis.quantity);
        }
        if (currentDesign.analysis.comments) {
          setDesignComments(currentDesign.analysis.comments);
        }
      }
    }
  }, [selectedDesign, designs]);

  // Add this effect to reset states when generating a new design
  useEffect(() => {
    if (generating) {
      setIsDesignFinalized(false);
      setRecommendationInfo(null);
      setSelectedMaterial('');
      setDimensions({ size: undefined, unit: 'inches' });
      setQuantity(1);
      setDesignComments('');
    }
  }, [generating]);

  // Add this useEffect to handle the scrolling
  useEffect(() => {
    if (scrollToAnalysis && analysisRef.current) {
      // Add a small delay to ensure the state has updated
      setTimeout(() => {
        const headerOffset = 80; // Adjust this value based on your header height
        const elementPosition = analysisRef.current?.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        
        setScrollToAnalysis(false);
      }, 100);
    }
  }, [scrollToAnalysis]);

  const handleImageUpload = async (file: File) => {
    try {
      console.log('1. Starting image upload...');
      setIsLoading(true);

      // First, convert the file to base64
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      console.log('2. Image converted to base64');

      // Save to Firebase
      const tempUserId = 'temp-user-123'; // We'll replace this with real auth later
      const savedDesign = await saveDesignToFirebase({
        imageUrl: base64String,
        prompt: 'User uploaded design',
        userId: tempUserId,
        mode: 'uploaded'
      });

      console.log('3. Design saved to Firebase:', savedDesign);

      setCurrentDesign({
        id: savedDesign.id,
        imageUrl: savedDesign.imageUrl,
        prompt: 'User uploaded design'
      });

      toast({
        title: "Success",
        description: "Image uploaded successfully"
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to upload image'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update your file input handler
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  // Or if you're using react-dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      console.log('1. File dropped, processing...');
      const file = acceptedFiles[0];
      if (!file) return;

      setIsLoading(true);

      // Convert file to base64
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('2. File converted to base64');
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      // Save to Firebase
      const tempUserId = 'temp-user-123';
      console.log('3. Calling saveDesignToFirebase');
      const savedDesign = await saveDesignToFirebase({
        imageUrl: base64String,
        prompt: 'User uploaded design',
        userId: tempUserId,
        mode: 'uploaded'
      });

      console.log('4. Design saved:', savedDesign);

      // Update UI with the saved design
      setSelectedDesign(savedDesign.imageUrl);
      
      toast({
        title: "Success",
        description: "Design uploaded successfully"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload design"
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // When generated image is clicked
  const handleDesignClick = async (imageUrl: string) => {
    try {
      console.log('1. Design clicked, saving to Firebase...');
      const tempUserId = 'temp-user-123';
      
      const savedDesign = await saveDesignToFirebase({
        imageUrl,
        prompt: designPrompt,
        userId: tempUserId,
        mode: 'generated'
      });

      console.log('2. Design saved:', savedDesign);
      setSelectedDesign(savedDesign.imageUrl);
      
      toast({
        title: "Success",
        description: "Design saved successfully"
      });
    } catch (error) {
      console.error('Error saving design:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save design"
      });
    }
  };

  // Update the handle3DProcessing function
  const handle3DProcessing = async () => {
    if (!selectedDesign) return;
    
    setProcessing3D(true);
    try {
      const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/process_3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: selectedDesign,
          userId: session?.user?.id || 'anonymous'
        }),
      });

      const responseData = await response.text();
      
      if (!response.ok) {
        console.error('Cloud Function error details:', {
          status: response.status,
          statusText: response.statusText,
          body: responseData
        });
        throw new Error(`Failed to process 3D model: ${response.statusText}`);
      }

      const data: Process3DResponse = JSON.parse(responseData);
      
      if (data.success) {
        // Update the design in the store with the video URL as soon as it's available
        const currentDesign = designs.find(d => d.images.includes(selectedDesign));
        if (currentDesign && data.video_url) {
          updateDesign(currentDesign.id, {
            threeDData: {
              ...currentDesign.threeDData,
              videoUrl: data.video_url,
              timestamp: data.timestamp
            }
          });

          toast({
            title: "Success",
            description: "3D preview ready"
          });
        }
      } else {
        throw new Error('Processing failed');
      }
    } catch (error) {
      console.error('3D processing error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate 3D preview"
      });
    } finally {
      setProcessing3D(false);
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <h1 className={headingStyles.h1}>
              Manufacturing AI Assistant
            </h1>
            
            {/* Add auth button */}
            {session ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-black">{session.user?.name}</span>
                </div>
                <button
                  onClick={() => signIn("google")}
                  className="px-4 py-2 text-black hover:text-gray-900"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Image
                  src="/google.svg"
                  alt="Google"
                  width={20}
                  height={20}
                />
                <span className="text-black">Sign in with Google</span>
              </button>
            )}
          </div>
        </div>

        {/* How it Works Section */}
        <div className="mb-12 bg-white rounded-xl shadow-sm overflow-hidden">
          <h2 className="text-2xl font-bold text-gray-900 p-6 border-b">
            How it Works
          </h2>
          
          <div className="steps-container p-6">
            {/* Step 1 */}
            <div className="step flex items-start gap-4 pb-8 relative">
              <div className="flex-none">
                <span className="number flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                  1
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Generate Design
                </h3>
                <p className="text-gray-600">
                  Type a description or upload a reference image to create your design with AI
                </p>
              </div>
              {/* Connector Line */}
              <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-gray-200" />
            </div>

            {/* Step 2 */}
            <div className="step flex items-start gap-4 pb-8 relative">
              <div className="flex-none">
                <span className="number flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                  2
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Choose Production
                </h3>
                <p className="text-gray-600">
                  Select your materials and manufacturing method
                </p>
              </div>
              {/* Connector Line */}
              <div className="absolute left-4 top-12 bottom-0 w-[2px] bg-gray-200" />
            </div>

            {/* Step 3 */}
            <div className="step flex items-start gap-4">
              <div className="flex-none">
                <span className="number flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold">
                  3
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Complete Order
                </h3>
                <p className="text-gray-600">
                  Review specifications and confirm your order
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Generation Form */}
          <div>
            {/* Input Method Selection */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
              {/* Tab Selection - Made more prominent */}
              <div className="grid grid-cols-2 gap-0.5 p-1 bg-gray-100 rounded-lg m-4">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`
                    py-4 px-6 rounded-lg flex flex-col items-center gap-2 transition-all
                    ${inputMethod === 'text'
                      ? 'bg-white shadow-sm text-blue-600'
                      : 'bg-transparent text-gray-600 hover:bg-white/50'
                    }
                  `}
                >
                  <Wand className={`w-6 h-6 ${inputMethod === 'text' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="font-medium">Generate New Idea</span>
                  <span className="text-xs text-gray-500">Create from text description</span>
                </button>

                <button
                  onClick={() => setInputMethod('upload')}
                  className={`
                    py-4 px-6 rounded-lg flex flex-col items-center gap-2 transition-all
                    ${inputMethod === 'upload'
                      ? 'bg-white shadow-sm text-blue-600'
                      : 'bg-transparent text-gray-600 hover:bg-white/50'
                    }
                  `}
                >
                  <Upload className={`w-6 h-6 ${inputMethod === 'upload' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="font-medium">Upload Existing Idea</span>
                  <span className="text-xs text-gray-500">Use your own image</span>
                </button>
              </div>

              {/* Content Section */}
              <div className="p-6">
                <div className="space-y-6">
                  {inputMethod === 'text' ? (
                    // Text Input Section
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <FileText className="w-4 h-4" />
                          <span>Describe your idea</span>
                        </div>
                        <textarea
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          placeholder="Describe what you'd like to create..."
                          className="w-full h-32 px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400"
                        />
                      </div>

                      {/* Reference Image Upload */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Upload className="w-4 h-4" />
                          <span>Add reference image (optional)</span>
                        </div>
                        <div className="space-y-4">
                          {/* Display uploaded reference images */}
                          {inspirationImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {inspirationImages.map((imageUrl, index) => (
                                <div key={index} className="relative aspect-square">
                                  <img
                                    src={imageUrl}
                                    alt={`Reference ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspirationImages(prev => prev.filter((_, i) => i !== index));
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-white rounded-full hover:bg-gray-100"
                                  >
                                    <X className="w-4 h-4 text-gray-600" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Upload button */}
                          {inspirationImages.length < MAX_INSPIRATION_IMAGES && (
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition-colors text-center"
                            >
                              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600">Drop a reference image, or click to browse</p>
                              <p className="text-sm text-gray-500">Helps us better understand your vision</p>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/png,image/jpeg,image/svg+xml"
                                className="hidden"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Style Selection */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Palette className="w-4 h-4" />
                          <span>Style (Optional)</span>
                        </div>
                        
                        {/* Mobile-friendly style buttons */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'cartoon', label: 'Cartoon' },
                            { id: 'realistic', label: 'Realistic' },
                            { id: 'geometric', label: 'Geometric' }
                          ].map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setSelectedStyle(style.id)}
                              className={`
                                px-4 py-2 rounded-full text-sm font-medium
                                transition-colors duration-200
                                ${selectedStyle === style.id
                                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-200'
                                }
                              `}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generate Button - Full width on mobile */}
                      <button
                        onClick={handleGenerateClick}
                        disabled={generating || (!textPrompt && !uploadedFile)}
                        className="w-full mt-6 py-3 px-4 bg-blue-500 text-white rounded-lg 
                          hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed
                          transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Wand className="w-5 h-5" />
                            <span>Generate Design</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    // Upload Section - Simplified
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-lg p-12 cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <div className="text-center">
                          <p className="text-gray-600">Drop your image here, or click to browse</p>
                          <p className="text-sm text-gray-500">Upload photos, sketches, or inspiration images</p>
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Design History */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 mt-12">
              {/* Recent Designs Section */}
              <div className="bg-white rounded-lg shadow-sm">
                {/* Compact Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Designs</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => clearDesigns()}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear All
                    </button>
                    {userDesigns.length > 4 && (
                      <button
                        onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                        className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      >
                        {isHistoryCollapsed ? (
                          <>Show All <ChevronDown className="w-4 h-4" /></>
                        ) : (
                          <>Collapse <ChevronUp className="w-4 h-4" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dense Grid Layout */}
                <div className="p-2">
                  {userDesigns.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {(isHistoryCollapsed ? userDesigns.slice(0, 4) : userDesigns).map((design, index) => (
                        <div
                          key={index}
                          className="relative aspect-square group cursor-pointer"
                          onClick={() => {
                            setSelectedDesign(design.images[0]);
                            setShowAnalysis(true);
                            setScrollToAnalysis(true); // Set this to trigger the scroll effect
                          }}
                        >
                          {/* Design Thumbnail */}
                          <img
                            src={design.images[0]}
                            alt={`Design ${index + 1}`}
                            className={`w-full h-full object-cover rounded-md transition-opacity duration-200 ${
                              selectedDesign === design.images[0] ? 'ring-2 ring-blue-500' : ''
                            }`}
                            onError={handleImageError(design.images[0])}
                            onLoad={handleImageLoad(design.images[0])}
                          />

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                            <div className="absolute inset-0 flex flex-col justify-between p-2 text-white">
                              {/* Top Info */}
                              <div className="text-xs">
                                <p className="font-medium truncate">
                                  {design.title || `Design ${index + 1}`}
                                </p>
                                <p className="text-gray-300">
                                  {new Date(design.createdAt).toLocaleDateString()}
                                </p>
                              </div>

                              {/* Bottom Actions */}
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(design.images[0]);
                                  }}
                                  className="p-1.5 rounded bg-white/20 hover:bg-white/30"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowEditDialog(true);
                                  }}
                                  className="p-1.5 rounded bg-white/20 hover:bg-white/30"
                                  title="Edit"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Loading State */}
                          {imageStates[design.images[0]]?.loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-md">
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      No designs yet. Start by creating your first design above!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Size Limits & Guidelines Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
              <h3 className="text-xl font-bold text-gray-700 mb-6 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                Size Ranges & Creative Guidelines
              </h3>

              <div className="space-y-8">
                {/* Size Ranges Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">
                    Available Size Ranges
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800">Mini (2x2x2in)</p>
                      <p className="text-gray-700">Perfect for small decorative items and miniatures</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800">Small (3.5x3.5x3.5in)</p>
                      <p className="text-gray-700">Ideal for desktop accessories and small functional parts</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800">Medium (5x5x5in)</p>
                      <p className="text-gray-700">Great for most household items and medium-sized models</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-800">Large (10x10x10in)</p>
                      <p className="text-gray-700">Suitable for large display pieces and substantial items</p>
                    </div>
                  </div>
                </div>

                {/* Perfect For Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-3">
                    Perfect For
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">✨ Art pieces</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🎭 Character designs</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🏺 Display items</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🌊 Organic shapes</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🗿 Sculptural pieces</p>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    Good to Know
                  </h4>
                  <ul className="space-y-2 text-gray-600">
                    <li>• This is great for artistic and decorative items!</li>
                    <li>• Best for items where exact measurements aren't crucial</li>
                    <li>• Sizes are approximate and may vary slightly</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Manufacturing Analysis */}
          <div className="lg:sticky lg:top-6 self-start w-full" ref={analysisRef}>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg">
              {/* Header Section */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900">
                  Bring Your Idea to Life
                </h2>
                {selectedDesign && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {designs.find(d => d.images.includes(selectedDesign))?.title || 'Untitled Design'}
                    </span>
                    <span className="text-gray-500">
                      {new Date(designs.find(d => d.images.includes(selectedDesign))?.createdAt || '').toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="p-6">
                {selectedDesign ? (
                  <div className="space-y-8">
                    {/* Edit Button and Image Preview - Outside the locked section */}
                    <div className="space-y-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowEditDialog(true)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium flex items-center gap-1.5 text-sm transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Design
                        </button>
                        <button
                          onClick={handle3DProcessing}
                          disabled={processing3D}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium flex items-center gap-1.5 text-sm transition-colors"
                        >
                          {processing3D ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing... {/* You could add attempt number here if desired */}
                            </>
                          ) : (
                            <>
                              <Package className="w-4 h-4" />
                              Show in 3D
                            </>
                          )}
                        </button>
                      </div>

                      <div className="aspect-square rounded-lg overflow-hidden relative">
                        <img
                          src={selectedDesign}
                          alt="Selected Design"
                          className="w-full h-full object-cover transition-opacity duration-300"
                          loading="eager"
                          decoding="async"
                          onLoadStart={(e) => e.currentTarget.style.opacity = '0.5'}
                          onLoad={(e) => e.currentTarget.style.opacity = '1'}
                        />
                      </div>
                    </div>

                    {/* Add video preview below the buttons */}
                    {selectedDesign && designs.find(d => d.images.includes(selectedDesign))?.threeDData?.videoUrl && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">3D Preview</h4>
                        <video 
                          width="100%" 
                          height="auto" 
                          controls 
                          className="rounded-lg"
                          key={designs.find(d => d.images.includes(selectedDesign))?.threeDData?.videoUrl}
                        >
                          <source 
                            src={designs.find(d => d.images.includes(selectedDesign))?.threeDData?.videoUrl} 
                            type="video/mp4" 
                          />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}

                    {/* Finalize Design Button */}
                    <div className="space-y-2">
                      <button
                        onClick={async () => {
                          if (!selectedDesign) {
                            toast({
                              title: "Error",
                              description: "Please upload or generate a design first",
                              variant: "destructive"
                            });
                            return;
                          }

                          // Immediately set finalized state and unlock interface
                          setIsDesignFinalized(true);

                          // Show loading state for material recommendation
                          toast({
                            title: "Analyzing Design",
                            description: "Generating material recommendation...",
                            duration: 3000
                          });

                          // Get material recommendation in the background
                          try {
                            console.log('Starting material recommendation...');
                            const { recommendedMaterial, reason } = await getMaterialRecommendation(selectedDesign);
                            
                            console.log('Received recommendation:', { recommendedMaterial, reason });
                            
                            if (!recommendedMaterial || !reason) {
                              console.error('Invalid recommendation:', { recommendedMaterial, reason });
                              throw new Error('Invalid recommendation received');
                            }

                            setSelectedMaterial(recommendedMaterial);
                            setRecommendationInfo({ material: recommendedMaterial, reason });

                            // Store the complete analysis in the design store
                            const currentDesign = designs.find(d => d.images.includes(selectedDesign));
                            if (currentDesign) {
                              console.log('Storing analysis for design:', currentDesign.id);
                              updateDesign(currentDesign.id, {
                                analysis: {
                                  ...currentDesign.analysis,
                                  recommendedMaterial,
                                  reason,
                                  isFinalized: true,
                                  dimensions,
                                  quantity,
                                  comments: designComments,
                                  lastUpdated: new Date().toISOString()
                                }
                              });
                            }

                            toast({
                              title: "Success",
                              description: `Recommended Material: ${recommendedMaterial}`,
                              duration: 5000
                            });
    } catch (error) {
                            console.error('Material recommendation error:', error);
      toast({
                              title: "Notice",
                              description: "Material recommendation failed. Please select a material manually.",
        variant: "destructive",
                              duration: 5000
                            });
                          }
                        }}
                        disabled={isDesignFinalized}
                        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                          isDesignFinalized
                            ? 'bg-green-100 text-green-700 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        {isDesignFinalized ? (
                          <>
                            <Check className="w-5 h-5" />
                            Design Finalized
                          </>
                        ) : (
                          <>
                            <Lock className="w-5 h-5" />
                            Finalize Design
                          </>
                        )}
                      </button>
                      {!isDesignFinalized && (
                        <p className="text-sm text-gray-500 text-center">
                          Finalize your design to proceed with manufacturing options
                        </p>
                      )}
                    </div>

                    {/* Manufacturing Options - This section remains locked until finalized */}
                    <div className={`space-y-8 transition-all duration-200 ${
                      isDesignFinalized ? 'opacity-100' : 'opacity-50 pointer-events-none'
                    }`}>
                      {/* Manufacturing Analysis Component */}
                      <ManufacturingAnalysis
                        imageUrl={selectedDesign}
                        existingAnalysis={designs.find(d => d.images.includes(selectedDesign))?.analysis}
                        onAnalysisComplete={handleAnalysisComplete}
                        onRedoAnalysis={handleRedoAnalysis}
                        quantity={quantity}
                        onQuantityChange={setQuantity}
                        dimensions={dimensions}
                        onDimensionsChange={setDimensions}
                        isRedoing={isAnalyzing}
                        designComments={designComments}
                        onCommentsChange={setDesignComments}
                      />

                      {/* Material Selection */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className={headingStyles.h2}>
                            Select Material
                            {dimensions.size && (
                              <span className="ml-2 text-sm font-normal text-gray-800">
                                • Size: {dimensions.size} ({SIZES.find(s => s.name === dimensions.size)?.dimensions})
                              </span>
                            )}
                          </h3>
                        </div>

                        {/* Keep the recommendation display */}
                        {recommendationInfo && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
                              <div>
                                <p className="font-medium text-gray-900">
                                  Recommended: {recommendationInfo.material}
                                </p>
                                <p className="text-gray-600 mt-1">
                                  {recommendationInfo.reason}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                          {MATERIAL_OPTIONS.map((material) => {
                            const materialPrice = dimensions.size ? 
                              PRICING[dimensions.size as keyof typeof PRICING]?.[material.title.replace(' PLA', '') as keyof typeof PRICING.Mini] 
                              : null;

  return (
                              <div
                                key={material.title}
                                className={`p-4 rounded-lg border transition-all ${
                                  selectedMaterial === material.title
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300'
                                }`}
                                onClick={() => setSelectedMaterial(material.title)}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <h4 className={headingStyles.h4}>{material.title}</h4>
                                    <p className={textStyles.secondary}>{material.description}</p>
                                  </div>
                                  <div className="ml-4 pl-4 border-l">
                                    {dimensions.size ? (
                                      <div className="text-right">
                                        <p className={`text-lg font-bold ${
                                          typeof materialPrice === 'number' 
                                            ? 'text-blue-600' 
                                            : 'text-gray-600'
                                        }`}>
                                          {typeof materialPrice === 'number' 
                                            ? `$${materialPrice}`
                                            : materialPrice === 'contact us' 
                                              ? 'Contact for Quote'
                                              : material.cost}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-gray-600 font-medium">
                                        {material.cost}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Price and Delivery Estimate */}
                      {dimensions.size && selectedMaterial && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Price:</span>
                              <span className="font-medium text-gray-900">
                                {typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                                  ? `$${getPriceAndDelivery(dimensions.size, selectedMaterial).price}`
                                  : 'Contact us for quote'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Estimated Delivery:</span>
                              <span className="font-medium text-gray-900">
                                {getPriceAndDelivery(dimensions.size, selectedMaterial).delivery || 'Contact us'}
                              </span>
                            </div>
                            {quantity > 1 && typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number' && (
                              <div className="flex justify-between items-center text-blue-600">
                                <span>Bulk Discount (10% off):</span>
                                <span>-${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * 0.1).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between items-center font-semibold text-lg">
                                <span>Total:</span>
                                <span>
                                  {typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                                    ? `$${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * (quantity > 1 ? 0.9 : 1)).toFixed(2)}`
                                    : 'Contact us for quote'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Checkout Button */}
                      <button
                        onClick={handleGenerateManufacturingPlan}
                        disabled={!selectedMethod || isUpdatingPlan}
                        className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 
                          text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isUpdatingPlan ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Package className="w-5 h-5" />
                            {typeof getPriceAndDelivery(dimensions.size || '', selectedMaterial)?.price === 'number'
                              ? 'Proceed to Checkout'
                              : 'Request Quote'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Package className="w-12 h-12 text-gray-400 mb-4" />
                    <p className={`${textStyles.primary} mb-2`}>
                      Upload a design or generate one to get started
                    </p>
                    <p className={textStyles.secondary}>
                      Your manufacturing options will appear here
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Design</h3>
              <button
                onClick={() => setShowEditDialog(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Design Preview */}
            <div className="mb-4">
              <img
                src={selectedDesign || ''}
                alt="Current Design"
                className="w-full h-48 object-contain rounded-lg bg-gray-50"
              />
            </div>

            {/* Edit Instructions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your changes
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe how you want to modify this design..."
                className="w-full p-3 border rounded-lg h-32 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEditDialog(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEditDesign}
                disabled={isEditing || !editPrompt}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isEditing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4" />
                    <span>Update Design</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}