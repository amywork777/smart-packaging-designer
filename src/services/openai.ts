// Add type declaration for Vite env
interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OpenAI API key is not set in environment variables');
}

const ANALYZE_IMAGE_PROMPT = `Based on the image, fill this out appropriately: 
Product Details
• Dimensions: Provide approximate product dimensions, including key measurements (e.g., length, width, height, thickness).
• Weight: Indicate the product's weight, including packaging or main components, if applicable.
• Shape/Geometry: Describe the product's overall form or structure (e.g., round, rectangular, sleek, compact).
• Fragility: Highlight durability concerns or potential vulnerabilities (e.g., scratching, wear, impact sensitivity, or exposure to elements like water or heat).
• Material Composition: List the primary materials used in the product's construction.
• Weak Points: Identify any known areas prone to damage, wear, or failure.
• Quantity: Provide information on the unit packaging (e.g., individual box or master carton quantities).
• Storage/Shipping Conditions: Specify any key considerations during shipping or storage, such as stacking, temperature, or humidity sensitivity.
• Intended Market: Describe the primary audience or user demographic for the product.
• Customer Expectations: Outline customer expectations for the packaging and overall experience, focusing on protection, eco-friendliness, branding, and unboxing.`;

export const analyzeImage = async (imageBase64: string) => {
  try {
    console.log('Analyzing image...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: ANALYZE_IMAGE_PROMPT
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.toString()
                }
              }
            ]
          }
        ],
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error Details:', JSON.stringify(errorData, null, 2));
      throw new Error('Failed to analyze image');
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};

export const generatePackagingDesign = async (prompt: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert packaging design engineer. Provide detailed, specific, and technically accurate responses following the exact structure and requirements provided in the prompt. Ensure all 11 sections are included with comprehensive information for each bullet point."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate design');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return content.trim();
  } catch (error) {
    console.error('Error in generatePackagingDesign:', error);
    throw error;
  }
};