  const generateDesign = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const prompt = `You are a packaging design expert creating a comprehensive solution. Your response MUST include ALL 10 sections below with COMPLETE, DETAILED content for each section. If you cannot generate specific details, use reasonable estimates, but NEVER leave any section empty or incomplete.

[Previous product and requirements information...]

RESPONSE REQUIREMENTS:
1. You MUST write your response as 10 consecutive sections
2. Start each section with its number and title (e.g., "1. Materials Selection")
3. Include EVERY section in numerical order
4. Provide AT LEAST 4-5 sentences of specific content for each section
5. Use EXACT numbers for all measurements and costs
6. NEVER skip or abbreviate any section
7. NEVER use placeholders or [brackets]
8. If unsure about specific details, provide reasonable estimates
9. Maintain consistency across all sections
10. Format exactly as shown in the examples below

Required sections with MANDATORY content:

1. Materials Selection
MUST INCLUDE:
• Complete list of ALL materials used
• Specific costs for each material
• Properties and specifications
• Justification for each choice
Example: "The primary packaging uses corrugated cardboard (200gsm, $0.75/unit) for its excellent strength-to-weight ratio. Inner protection consists of EPE foam inserts ($0.50/unit) providing 15G shock absorption. Additional materials include..."

2. Packaging Methodology
MUST INCLUDE:
• Complete assembly process
• Protection methods
• Time and labor estimates
• Equipment requirements
Example: "The assembly process begins with the EPE foam insertion (15 seconds), followed by product placement (10 seconds). Each unit requires..."

3. Bill of Materials (BOM)
MUST INCLUDE:
• EVERY component listed separately
• EXACT measurements
• SPECIFIC costs
• Named suppliers
Format EXACTLY like this:
Individual Package Components:
1. Primary Box
   - Dimensions: 300x200x150mm
   - Quantity: 1 per unit
   - Unit cost: $0.75
   - Supplier: BoxCo Inc.
[List minimum 5 components]

Master Carton:
[List ALL components]

4. Cost Summary
MUST INCLUDE ALL THREE SECTIONS with EXACT numbers:
1. Individual Package Costs
- Material costs: $X.XX
- Labor costs: $X.XX
- Assembly costs: $X.XX
- Total per unit: $X.XX

2. Master Carton Costs
- Material costs: $X.XX
- Assembly costs: $X.XX
- Total per carton: $X.XX

3. Project Costs
- Development: $X,XXX
- Testing: $X,XXX
- Total project: $X,XXX

5. Sourcing
MUST INCLUDE:
• Named suppliers with locations
• Specific lead times
• Exact MOQs
• Quality certifications
Example: "Primary supplier BoxCo Inc. (Chicago, IL) provides 2-week lead time with 1000 MOQ. Secondary supplier..."

6. Weight and Volume
MUST INCLUDE:
• Individual package specs
• Master carton specs
• Loading quantities
• Shipping calculations
Example: "Individual packages measure 300x200x150mm, weighing 0.8kg. Master cartons measure..."

7. Testing and Validation
MUST INCLUDE:
• Specific test procedures
• Test parameters
• Quality controls
• Acceptance criteria
Example: "Drop testing from 1.2m height at 8 angles. Compression testing at 100kg force for 24 hours..."

8. Sustainability Features
MUST INCLUDE:
• Recycling specifications
• Environmental impact
• Waste reduction
• Certifications
Example: "100% recyclable materials with 80% post-consumer content. Carbon footprint of 0.5kg CO2e per unit..."

9. Compliance
MUST INCLUDE:
• Specific regulations
• Required certifications
• Testing standards
• Documentation
Example: "Meets ISTA 3A testing standards. Complies with EU Packaging Directive 94/62/EC..."

10. Customer Experience
MUST INCLUDE:
• Unboxing process
• User instructions
• Disposal guidance
• Special features
Example: "Premium unboxing experience with easy-open tabs. Clear instructions printed on inner flap..."

FINAL REQUIREMENTS:
• EVERY section MUST be completed with specific details
• NO section can be skipped or abbreviated
• Use EXACT numbers and measurements
• If specific details are unknown, provide reasonable estimates
• ALL sections must maintain consistency
• Format EXACTLY as shown in examples
• NEVER use placeholders or [brackets]
• Include AT LEAST 4-5 sentences per section
• Ensure ALL costs add up correctly
• Keep information consistent across sections

Begin your response now, starting with "1. Materials Selection" and continuing through all 10 sections in order. Do not skip any sections or leave any incomplete.`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          max_tokens: 4000,
          temperature: 0.7,
          model: "gpt-4",
          presence_penalty: 1.2,  // Increased to strongly encourage covering all topics
          frequency_penalty: 0.7,  // Increased to encourage more diverse content
          top_p: 0.95,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate design');
      }

      const data = await response.json();
      
      // Parse the response into sections
      const sections = [
        "Materials Selection",
        "Packaging Methodology",
        "Bill of Materials (BOM)",
        "Cost Summary",
        "Sourcing",
        "Weight and Volume",
        "Testing and Validation",
        "Sustainability Features",
        "Compliance",
        "Customer Experience"
      ];

      const design: { [key: string]: string } = {};

      // Initialize all sections to empty strings
      sections.forEach(section => {
        design[section] = '';
      });

      const lines = data.content.split('\n');
      let currentSection = "";
      let currentContent = "";
      
      // First pass: identify section boundaries
      const sectionBoundaries: { section: string, startIndex: number, endIndex: number }[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for section headers in different formats
        const numberMatch = line.match(/^(\d+)\.\s*(.*)/);
        const sectionMatch = sections.find(section => 
          line.includes(section) || 
          (numberMatch && numberMatch[2].includes(section))
        );

        if (sectionMatch) {
          if (currentSection) {
            sectionBoundaries.push({
              section: currentSection,
              startIndex: sectionBoundaries[sectionBoundaries.length - 1]?.endIndex || 0,
              endIndex: i
            });
          }
          currentSection = sectionMatch;
        }
      }

      // Add the last section boundary
      if (currentSection) {
        sectionBoundaries.push({
          section: currentSection,
          startIndex: sectionBoundaries[sectionBoundaries.length - 1]?.endIndex || 0,
          endIndex: lines.length
        });
      }

      // Second pass: extract content for each section
      sectionBoundaries.forEach(({ section, startIndex, endIndex }) => {
        let content = lines.slice(startIndex, endIndex)
          .filter(line => {
            const trimmedLine = line.trim();
            return trimmedLine && 
                   !trimmedLine.match(/^(\d+)\.\s*$/) && 
                   !sections.some(s => trimmedLine === s) &&
                   !trimmedLine.match(/^\[.*\]$/) &&
                   !trimmedLine.startsWith('IMPORTANT REQUIREMENTS:') &&
                   !trimmedLine.startsWith('REQUIRED RESPONSE FORMAT:');
          })
          .join('\n')
          .trim();

        if (content) {
          design[section] = content;
        }
      });

      // Special handling for Cost Summary subsections
      if (!design["Cost Summary"] || design["Cost Summary"].trim() === '') {
        // Always generate a basic cost structure if empty or missing
        design["Cost Summary"] = `1. Individual Package Costs
- Material costs: $3.60 (EPE foam: $2.50, Kraft box: $0.75, Polybag: $0.10, Labels: $0.20, Tape: $0.05)
- Labor costs: $1.00
- Assembly costs: $0.50
- Total per unit: $5.10

2. Master Carton Costs
- Material costs: $3.00
- Assembly costs: $0.50
- Total per carton: $3.50

3. Project Costs
- Development: $5000
- Testing: $2000
- Total project: $7000`;
      }

      // Always generate default content for empty sections
      sections.forEach(section => {
        if (!design[section] || design[section].trim() === '') {
          console.warn(`Generating default content for section: ${section}`);
          
          // Use image analysis and form data to make educated estimates
          const defaultContent = {
            "Bill of Materials (BOM)": `Individual Package Components:
1. Primary Box
   - Dimensions: ${productInfo.dimensions ? `Box sized to fit ${productInfo.dimensions} with 25mm padding` : "400mm x 300mm x 200mm"}
   - Quantity: 1 per unit
   - Unit cost: $0.75
   - Supplier: PackagingPro

2. Protective Foam Insert
   - Dimensions: Custom molded to product size
   - Quantity: 1 per unit
   - Unit cost: $2.50
   - Supplier: FoamTech Solutions

3. Protective Polybag
   - Dimensions: ${productInfo.dimensions ? `Bag sized to fit ${productInfo.dimensions} with 50mm extra` : "450mm x 350mm"}
   - Quantity: 1 per unit
   - Unit cost: $0.10
   - Supplier: PlasticWrap Inc.

4. Adhesive Labels
   - Dimensions: 100mm x 150mm
   - Quantity: 1 per unit
   - Unit cost: $0.20
   - Supplier: LabelCraft

5. Eco-friendly Tape
   - Dimensions: 50m roll
   - Quantity: 0.5m per unit
   - Unit cost: $0.05
   - Supplier: GreenTape Co.

Master Carton Components:
1. Corrugated Box
   - Dimensions: ${productInfo.dimensions ? 
       `Master carton sized to fit 10 units of ${productInfo.dimensions}` : 
       "850mm x 650mm x 450mm"}
   - Quantity: 1 per 10 units
   - Unit cost: $3.00
   - Supplier: BoxCraft Industries`,

            "Weight and Volume": `Based on the product dimensions ${productInfo.dimensions || 'provided'} and weight ${productInfo.weight || 'analyzed'}, 
the individual package measures ${productInfo.dimensions ? 
  `slightly larger than ${productInfo.dimensions} with protective padding` : 
  "400mm x 300mm x 200mm"} and weighs approximately ${
    productInfo.weight ? 
    `${parseFloat(productInfo.weight) + 0.3}kg including packaging` : 
    "0.8kg"} total. 
The master carton is designed to hold 10 units efficiently and measures ${
  productInfo.dimensions ? 
  `approximately twice the product dimensions in width and length, and 5 times in height` : 
  "850mm x 650mm x 450mm"
}. 
A fully loaded master carton weighs ${
  productInfo.weight ? 
  `approximately ${(parseFloat(productInfo.weight) + 0.3) * 10 + 0.5}kg` : 
  "8.5kg"
}. 
The shipping volume for a master carton is ${
  productInfo.dimensions ? 
  `calculated based on outer dimensions with standard padding` : 
  "0.249"
} cubic meters. 
Each pallet can safely stack ${
  productInfo.weight ? 
  `${Math.floor(180 / ((parseFloat(productInfo.weight) + 0.3) * 10 + 0.5))}` : 
  "4"
} master cartons based on weight distribution.`,

            "Testing and Validation": `Based on the product type ${productInfo.type || 'and characteristics'}, 
the following testing protocol has been established:

Drop Testing:
- Drop height: ${productInfo.value > 1000 ? "1.8" : "1.2"}m (based on product value $${productInfo.value || 'and fragility'})
- Multiple angle drops: 8 points of impact
- Minimum 5 samples tested

Compression Testing:
- Static load: ${productInfo.weight ? `${Math.ceil(parseFloat(productInfo.weight) * 50)}` : "100"}kg force
- Duration: 24 hours
- Stack height simulation: ${productInfo.weight ? `${Math.floor(180 / parseFloat(productInfo.weight))}` : "4"} units

Environmental Testing:
- Temperature range: ${
  productInfo.specialHandling?.includes('temperature') ? 
  "-10°C to 50°C" : 
  "-5°C to 40°C"
}
- Humidity exposure: ${
  productInfo.specialHandling?.includes('moisture') ? 
  "95%" : 
  "90%"
}% for 48 hours
- Vibration test: 2 hours random vibration

Quality Control:
- 100% visual inspection
- Dimensional verification: ±2mm tolerance
- Random sampling: 1 unit per 100 for detailed testing
- Barcode/label verification: 100% scan test`,

            "Sourcing": `Based on the product requirements and specifications:

Primary Suppliers:
- ${productInfo.type ? `Specialized ${productInfo.type} packaging supplier` : 'PackagingPro'} (Main packaging components)
  Lead time: 2 weeks
  MOQ: 1000 units
  ISO 9001:2015 certified

- ${productInfo.specialHandling ? 'Custom Protection Solutions' : 'FoamTech'} (Protective materials)
  Lead time: 2-3 weeks
  MOQ: 500 units
  ISO 14001 certified

Secondary Suppliers:
- Backup suppliers identified for all critical components
- 25% additional capacity available on demand
- Local suppliers prioritized for reduced lead times`,

            "Sustainability Features": `Environmental Considerations:
- Primary packaging: ${
  designRequirements.sustainability?.includes('recycl') ? 
  '100% recyclable materials' : 
  '80% recycled content'
}
- Protective materials: ${
  designRequirements.sustainability?.includes('biodeg') ? 
  'Biodegradable alternatives' : 
  'Recyclable through specialized facilities'
}
- Carbon footprint: ${
  productInfo.weight ? 
  `${(parseFloat(productInfo.weight) * 0.3).toFixed(2)}` : 
  "0.5"
}kg CO2e per package
- Water-based inks and eco-friendly adhesives
- Material utilization rate: 95%
- End-of-life recyclability: ${
  designRequirements.sustainability?.includes('100') ? 
  '100%' : 
  '95%'
}`,

            "Compliance": `Based on product type ${productInfo.type || 'and requirements'}:

Testing Standards:
- ISTA 3A (International Safe Transit Association)
- ASTM D4169 (Shipping Container Testing)
- ISO 14001 (Environmental Management)

Certifications:
- FSC (Forest Stewardship Council) for paper components
- RoHS compliance for any plastic components
- ${productInfo.type ? `Specific ${productInfo.type} packaging certifications` : 'General packaging safety certifications'}

Regulations:
- EU Packaging Directive 94/62/EC
- Local recycling regulations
- ${productInfo.type ? `Industry-specific ${productInfo.type} regulations` : 'General packaging regulations'}`,

            "Customer Experience": `Unboxing Experience:
- Easy-open design with ${
  designRequirements.userExperience?.includes('premium') ? 
  'premium tear strips' : 
  'pull tabs'
}
- Clear instructions printed on ${
  designRequirements.branding?.includes('minimal') ? 
  'a simple insert card' : 
  'the inner flap'
}
- Product presentation optimized for ${
  designRequirements.userExperience?.includes('retail') ? 
  'retail display' : 
  'user convenience'
}
- QR code linking to detailed setup and recycling guidelines
- Color-coded recycling indicators for each component`
          };

          design[section] = defaultContent[section] || 'Content not provided by the AI. Please try regenerating.';
        }
      });

      // Add debug logging
      console.log('API Response:', data.content);
      console.log('Parsed Design:', design);
      console.log('Section Boundaries:', sectionBoundaries);

      // Navigate to design page with the parsed data
      navigate('/design', { state: { design, productInfo } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }; 