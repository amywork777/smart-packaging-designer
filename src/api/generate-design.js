import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a packaging design expert. Provide detailed, specific responses for each section of the packaging design specification."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000
    });

    const response = completion.data.choices[0].message.content;

    // Parse the response into sections
    const sections = {};
    const sectionRegex = /^(\d+\.\s*[\w\s()]+):\n([\s\S]*?)(?=\n\d+\.\s*[\w\s()]+:|$)/gm;
    let match;

    while ((match = sectionRegex.exec(response)) !== null) {
      const sectionName = match[1].replace(/^\d+\.\s*/, '').trim();
      const content = match[2].trim();
      sections[sectionName] = content;
    }

    return res.status(200).json(sections);
  } catch (error) {
    console.error('Error generating design:', error);
    return res.status(500).json({ error: 'Failed to generate design' });
  }
} 