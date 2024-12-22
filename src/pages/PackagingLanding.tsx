import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Upload, Info, Sparkles, X } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import BudgetInput from '../components/BudgetInput';
import { analyzeImage, generatePackagingDesign } from '../services/openai.ts';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

const PACKAGING_PROMPT_TEMPLATE = `You are an expert packaging design engineer. Please analyze this product information and create a comprehensive packaging solution.

PRODUCT ANALYSIS:
[IMAGE_ANALYSIS]

SURVEY DATA AND REQUIREMENTS:
Product Specifications:
- Dimensions: [DIMENSIONS]
- Weight: [WEIGHT]
- Fragility Level: [FRAGILITY]
- Items per Package: [ITEMS_PER_PACKAGE]
- Total Packages: [TOTAL_PACKAGES]

Shipping Requirements:
- Origin: [ORIGIN]
- Destination: [DESTINATION]
- Method: [METHOD]

Special Requirements:
- Temperature: [TEMPERATURE]
- Moisture Protection: [MOISTURE]
- Regulatory: [REGULATORY]
- Material Preference: [MATERIAL_PREFERENCE]
- Certifications: [CERTIFICATIONS]

Budget Constraints:
- Type: [BUDGET_TYPE]
- Minimum: [BUDGET_MIN]
- Maximum: [BUDGET_MAX]

Additional Notes:
[DESCRIPTION]

Based on both the image analysis and survey data, please provide a comprehensive packaging analysis and solution with the following structure:

1. Product Analysis Summary
- Complete product specifications from image and survey data
- Note any overridden values from survey data
- Document all critical requirements and constraints

2. Materials Selection
- Comprehensive list of materials for individual and master packaging
- Material properties and performance characteristics
- Justification for each material choice
- Cost breakdown per unit
- Alternative material options if applicable

3. Packaging Methodology
- Detailed step-by-step assembly process
- Material handling instructions
- Packaging hierarchy specification
- Assembly line requirements
- Quality control checkpoints

4. Bill of Materials (BOM)
- Itemized component list
- Quantity requirements per unit
- Unit cost and total cost calculations
- Supplier details
- Component specifications
- Purpose of each component

5. Cost Summary
- Material costs breakdown
- Estimated labor costs
- Shipping and handling costs
- Overhead costs
- Total unit cost calculation
- Cost optimization recommendations

6. Sourcing Strategy
- Qualified supplier list
- Lead time estimates
- Minimum order quantities
- Quality certifications
- Supplier reliability metrics
- Geographic considerations

7. Weight and Volume Specifications
- Individual package dimensions and weight
- Master carton specifications
- Units per master carton
- Shipping volume calculations
- Pallet configuration
- Container loading efficiency

8. Testing and Validation Plan
- Required compliance tests
- Drop test specifications
- Vibration test requirements
- Environmental condition tests
- Quality assurance protocols
- Validation methodology

9. Sustainability Analysis
- Recycling specifications
- Environmental impact assessment
- Carbon footprint calculation
- End-of-life considerations
- Sustainable material alternatives
- Waste reduction strategies

10. Compliance Requirements
- Applicable standards list
- Required certifications
- Documentation requirements
- Safety regulations
- Industry-specific requirements
- Labeling requirements

11. Customer Experience Design
- Unboxing experience design
- Assembly instructions
- Disposal guidelines
- Customer feedback integration
- Brand alignment
- User interaction points

Please provide detailed specifications, measurements, costs, and technical requirements for each category. The solution should prioritize:
- Safety and product protection
- Cost efficiency
- Sustainability
- Regulatory compliance
- Premium customer experience
- Manufacturing feasibility
- Supply chain optimization

Base all recommendations on both the image analysis and survey data, ensuring survey data takes precedence where conflicts exist.`;

const PackagingLanding: React.FC = () => {
  console.log('PackagingLanding mounting');
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [formData, setFormData] = useState({
    packaging: {
      itemsPerPackage: '1',
      numberOfPackages: '1',
    },
    dimensions: {
      length: '',
      width: '',
      height: '',
      unit: 'cm' // or 'in'
    },
    weight: {
      value: '',
      unit: 'kg' // or 'lb'
    },
    fragility: '',
    shipping: {
      startZip: '',
      endZip: '',
      method: ''
    },
    requirements: {
      temperature: '',
      moisture: '',
      regulatory: '',
      materialPreference: '',
      materialComposition: '',
      certifications: ''
    },
    budget: {
      type: 'total', // or 'perUnit'
      min: '',
      max: ''
    },
    description: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
    }
  };

  const removeImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage);
      setUploadedImage(null);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      // Handle nested object paths (e.g., 'packaging.itemsPerPackage')
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      }
      // Handle top-level fields
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const steps = [
    { number: 1, label: 'Product Info' },
    { number: 2, label: 'Shipping' },
    { number: 3, label: 'Requirements' },
    { number: 4, label: 'Budget' },
    { number: 5, label: 'Additional' }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Items (as shown in image) per Package
                  </Label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.packaging.itemsPerPackage}
                    onChange={(e) => handleInputChange('packaging.itemsPerPackage', e.target.value)}
                    className="text-center h-12 text-lg"
                    placeholder="1"
                  />
                  <span className="text-sm text-gray-500">
                    Number of items shown in the image that will go in each package
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Number of Packages
                  </Label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.packaging.numberOfPackages}
                    onChange={(e) => handleInputChange('packaging.numberOfPackages', e.target.value)}
                    className="text-center h-12 text-lg"
                    placeholder="1"
                  />
                  <span className="text-sm text-gray-500">
                    How many packages you need
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="text-sm font-medium text-blue-900">
                  Total Items: {parseInt(formData.packaging.itemsPerPackage || 0) * parseInt(formData.packaging.numberOfPackages || 0)}
                  <span className="text-blue-700 ml-2">
                    ({formData.packaging.numberOfPackages} {parseInt(formData.packaging.numberOfPackages) === 1 ? 'package' : 'packages'} × {formData.packaging.itemsPerPackage} {parseInt(formData.packaging.itemsPerPackage) === 1 ? 'item' : 'items'} each)
                  </span>
                </div>
              </div>
            </div>

            <DimensionsInput />

            <div className="space-y-4">
              <Label className="text-sm font-medium">Weight (per unit)</Label>
              <div className="flex gap-4 items-start">
                <Input 
                  type="number"
                  value={formData.weight.value}
                  onChange={(e) => handleInputChange('weight.value', e.target.value)}
                  placeholder="0"
                  className="text-center h-12 text-lg max-w-[200px]"
                />
                <Select 
                  value={formData.weight.unit}
                  onValueChange={(value) => handleInputChange('weight.unit', value)}
                  className="w-[100px]"
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lb">lb</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Fragility Level</Label>
              <Select 
                value={formData.fragility} 
                onValueChange={(value) => handleInputChange('fragility', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fragility level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High Fragility</SelectItem>
                  <SelectItem value="medium">Medium Fragility</SelectItem>
                  <SelectItem value="low">Low Fragility</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Original Destination ZIP Code</Label>
                <Input 
                  type="text"
                  value={formData.shipping.startZip}
                  onChange={(e) => handleInputChange('shipping.startZip', e.target.value)}
                  placeholder="Enter ZIP code"
                  maxLength={5}
                />
                <span className="text-xs text-gray-500 mt-1 block">Where empty packages will be delivered for assembly</span>
              </div>
              <div>
                <Label className="text-sm font-medium">Final Destination ZIP Code</Label>
                <Input 
                  type="text"
                  value={formData.shipping.endZip}
                  onChange={(e) => handleInputChange('shipping.endZip', e.target.value)}
                  placeholder="Enter ZIP code"
                  maxLength={5}
                />
                <span className="text-xs text-gray-500 mt-1 block">Where packaged products will be shipped</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Shipping Method</Label>
              <Select 
                value={formData.shipping.method} 
                onValueChange={(value) => handleInputChange('shipping.method', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shipping method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ground">Ground</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium">Temperature Requirements</Label>
              <Select 
                value={formData.requirements.temperature} 
                onValueChange={(value) => handleInputChange('requirements.temperature', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select temperature range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Room Temperature (68-77°F / 20-25°C)</SelectItem>
                  <SelectItem value="cool">Cool (35-46°F / 2-8°C)</SelectItem>
                  <SelectItem value="frozen">Frozen (-4°F / -20°C)</SelectItem>
                  <SelectItem value="deep-frozen">Deep Frozen (-94°F / -70°C)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Moisture Protection</Label>
              <Select 
                value={formData.requirements.moisture} 
                onValueChange={(value) => handleInputChange('requirements.moisture', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select moisture protection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard Protection</SelectItem>
                  <SelectItem value="moisture-resistant">Moisture Resistant</SelectItem>
                  <SelectItem value="waterproof">Waterproof</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Regulatory Requirements</Label>
              <Select 
                value={formData.requirements.regulatory} 
                onValueChange={(value) => handleInputChange('requirements.regulatory', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select requirements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Special Requirements</SelectItem>
                  <SelectItem value="fda">FDA Compliant</SelectItem>
                  <SelectItem value="medical">Medical Device Packaging</SelectItem>
                  <SelectItem value="hazmat">Hazardous Materials</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Material Preferences</Label>
              <Select 
                value={formData.requirements.materialPreference} 
                onValueChange={(value) => {
                  handleInputChange('requirements.materialPreference', value);
                  // Reset certification when material changes
                  handleInputChange('requirements.certifications', 'none');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select material preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Material Preference</SelectItem>
                  <SelectItem value="biodegradable">Biodegradable Materials</SelectItem>
                  <SelectItem value="recyclable">Recyclable Materials</SelectItem>
                  <SelectItem value="reusable">Reusable Materials</SelectItem>
                  <SelectItem value="mixed">Mixed Materials</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-500 mt-1 block">
                Material choice will affect available certifications
              </span>
            </div>

            <div>
              <Label className="text-sm font-medium">Sustainability Certifications</Label>
              <Select 
                value={formData.requirements.certifications}
                onValueChange={(value) => handleInputChange('requirements.certifications', value)}
                disabled={!formData.requirements.materialPreference || formData.requirements.materialPreference === 'none'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select required certifications" />
                </SelectTrigger>
                <SelectContent>
                  {getCertificationOptions(formData.requirements.materialPreference).map(cert => (
                    <SelectItem key={cert.value} value={cert.value}>
                      {cert.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.requirements.materialPreference && (
                <span className="text-xs text-gray-500 mt-1 block">
                  Please select a material preference first
                </span>
              )}
            </div>
          </div>
        );
      case 4:
        return (
          <BudgetInput
            quantity={parseInt(formData.packaging.itemsPerPackage) * parseInt(formData.packaging.numberOfPackages) || 0}
            onBudgetChange={(budgetData) => {
              setFormData(prev => ({
                ...prev,
                budget: budgetData
              }));
            }}
          />
        );
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium">Additional Requirements</Label>
              <Textarea 
                placeholder="Describe any specific requirements or concerns about your product packaging..."
                className="h-32"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            {/* Packaging Artwork Studio Button */}
            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="w-full h-auto py-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => {/* Add your artwork studio logic here */}}
              >
                <span className="flex flex-col items-center">
                  <span className="font-medium">Open Packaging Artwork Studio</span>
                  <span className="text-xs text-gray-500">(Optional)</span>
                </span>
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const DimensionsInput = () => (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Dimensions (per unit)</Label>
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          <Input 
            type="number"
            placeholder="0"
            value={formData.dimensions.length}
            onChange={(e) => handleInputChange('dimensions.length', e.target.value)}
            className="text-center h-12 text-lg"
          />
          <Label className="text-xs text-gray-500 block text-center">Length</Label>
        </div>
        <div className="space-y-2">
          <Input 
            type="number"
            placeholder="0"
            value={formData.dimensions.width}
            onChange={(e) => handleInputChange('dimensions.width', e.target.value)}
            className="text-center h-12 text-lg"
          />
          <Label className="text-xs text-gray-500 block text-center">Width</Label>
        </div>
        <div className="space-y-2">
          <Input 
            type="number"
            placeholder="0"
            value={formData.dimensions.height}
            onChange={(e) => handleInputChange('dimensions.height', e.target.value)}
            className="text-center h-12 text-lg"
          />
          <Label className="text-xs text-gray-500 block text-center">Height</Label>
        </div>
      </div>
      <Select 
        value={formData.dimensions.unit}
        onValueChange={(value) => handleInputChange('dimensions.unit', value)}
        className="w-full max-w-[120px]"
      >
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cm">cm</SelectItem>
          <SelectItem value="in">in</SelectItem>
          <SelectItem value="m">m</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const getCertificationOptions = (materialPreference) => {
    switch (materialPreference) {
      case 'biodegradable':
        return [
          { value: 'biodegradable', label: 'Biodegradable Standard' },
          { value: 'compostable', label: 'Compostable Certified' },
          { value: 'fsc', label: 'FSC Certified' },
          { value: 'none', label: 'No Certification Required' }
        ];
      case 'recyclable':
        return [
          { value: 'fsc', label: 'FSC Certified' },
          { value: 'none', label: 'No Certification Required' }
        ];
      case 'reusable':
        return [
          { value: 'fsc', label: 'FSC Certified' },
          { value: 'none', label: 'No Certification Required' }
        ];
      case 'mixed':
        return [
          { value: 'fsc', label: 'FSC Certified' },
          { value: 'none', label: 'No Certification Required' }
        ];
      default:
        return [
          { value: 'none', label: 'No Certification Required' }
        ];
    }
  };

  const handleGenerate = async () => {
    try {
      setError(null);
      setIsGenerating(true);
      
      if (!uploadedImage) {
        throw new Error('Please upload a product image first');
      }
      
      console.log('Starting image analysis...');
      const imageBase64 = await fetch(uploadedImage)
        .then(res => res.blob())
        .then(blob => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        });
      
      console.log('Image Base64 length:', imageBase64.toString().length);
      const imageAnalysis = await analyzeImage(imageBase64);
      console.log('Image Analysis Result:', imageAnalysis);

      if (!imageAnalysis) {
        throw new Error('Failed to analyze image. Please try again.');
      }
      
      // Use formData directly
      const resultToUse = formData;
      
      // Create safe version with image analysis as fallback
      const safeResult = {
        dimensions: {
          length: resultToUse?.dimensions?.length || imageAnalysis?.dimensions?.length || '0',
          width: resultToUse?.dimensions?.width || imageAnalysis?.dimensions?.width || '0',
          height: resultToUse?.dimensions?.height || imageAnalysis?.dimensions?.height || '0',
          unit: resultToUse?.dimensions?.unit || 'mm'
        },
        weight: {
          value: resultToUse?.weight?.value || imageAnalysis?.weight || '0',
          unit: resultToUse?.weight?.unit || 'kg'
        },
        fragility: resultToUse?.fragility || imageAnalysis?.fragility || 'not specified',
        packaging: {
          itemsPerPackage: resultToUse?.packaging?.itemsPerPackage || '1',
          numberOfPackages: resultToUse?.packaging?.numberOfPackages || '1'
        },
        shipping: {
          startZip: resultToUse?.shipping?.startZip || 'not specified',
          endZip: resultToUse?.shipping?.endZip || 'not specified',
          method: resultToUse?.shipping?.method || 'ground'  // reasonable default
        },
        requirements: {
          temperature: resultToUse?.requirements?.temperature || 
            (imageAnalysis?.storageConditions?.includes('temperature') ? imageAnalysis.storageConditions : 'room temperature'),
          moisture: resultToUse?.requirements?.moisture || 
            (imageAnalysis?.storageConditions?.includes('humidity') ? 'moisture-resistant' : 'standard'),
          regulatory: resultToUse?.requirements?.regulatory || 'none',
          materialPreference: resultToUse?.requirements?.materialPreference || 'none',
          certifications: resultToUse?.requirements?.certifications || 'none'
        },
        budget: {
          type: resultToUse?.budget?.type || 'not specified',
          min: resultToUse?.budget?.min || '0',
          max: resultToUse?.budget?.max || '0'
        },
        description: resultToUse?.description || imageAnalysis?.additionalNotes || ''
      };
      
      const finalPrompt = PACKAGING_PROMPT_TEMPLATE
        .replace('[IMAGE_ANALYSIS]', imageAnalysis)
        .replace('[DIMENSIONS]', `${safeResult.dimensions.length}x${safeResult.dimensions.width}x${safeResult.dimensions.height} ${safeResult.dimensions.unit}`)
        .replace('[WEIGHT]', `${safeResult.weight.value} ${safeResult.weight.unit}`)
        .replace('[FRAGILITY]', safeResult.fragility)
        .replace('[ITEMS_PER_PACKAGE]', safeResult.packaging.itemsPerPackage)
        .replace('[TOTAL_PACKAGES]', safeResult.packaging.numberOfPackages)
        .replace('[ORIGIN]', safeResult.shipping.startZip)
        .replace('[DESTINATION]', safeResult.shipping.endZip)
        .replace('[METHOD]', safeResult.shipping.method)
        .replace('[TEMPERATURE]', safeResult.requirements.temperature)
        .replace('[MOISTURE]', safeResult.requirements.moisture)
        .replace('[REGULATORY]', safeResult.requirements.regulatory)
        .replace('[MATERIAL_PREFERENCE]', safeResult.requirements.materialPreference)
        .replace('[CERTIFICATIONS]', safeResult.requirements.certifications)
        .replace('[BUDGET_TYPE]', safeResult.budget.type)
        .replace('[BUDGET_MIN]', safeResult.budget.min)
        .replace('[BUDGET_MAX]', safeResult.budget.max)
        .replace('[DESCRIPTION]', safeResult.description);
      
      // Final API call - Generate packaging design
      console.log('Generating design...');
      console.log('Sending prompt to API:', finalPrompt);
      const designResult = await generatePackagingDesign(finalPrompt);
      console.log('Design generated:', designResult);

      if (!designResult || typeof designResult !== 'string') {
        throw new Error('Invalid design result received');
      }

      // Add a small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Navigating to design page with:', {
        design: designResult,
        productInfo: safeResult
      });

      // Navigate to design page with results
      navigate('/design', { 
        state: { 
          design: designResult,
          productInfo: safeResult
        } 
      });
    } catch (error) {
      console.error('Error generating design:', error);
      setError(error.message || 'Failed to generate design. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderDesignResult = () => {
    if (!generatedResult) return null;

    const sections = [
      'Materials Selection',
      'Packaging Methodology',
      'Bill of Materials (BOM)',
      'Cost Summary',
      'Sourcing',
      'Weight and Volume',
      'Testing and Validation',
      'Sustainability Features',
      'Compliance',
      'Customer Experience'
    ];

    return (
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <div key={section} className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4">{section}</h3>
            <div className="prose max-w-none">
              {generatedResult[section] ? (
                <div dangerouslySetInnerHTML={{ __html: generatedResult[section] }} />
              ) : (
                <p className="text-gray-500">No content provided</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
      {isGenerating ? <LoadingSpinner /> : null}
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Smart Package Designer</h1>
          <p className="text-gray-600">Design efficient packaging for your product</p>
        </header>

        {/* Step Indicators */}
        <div className="flex justify-between mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div 
                className={`flex flex-col items-center cursor-pointer hover:text-blue-500 transition-colors
                  ${currentStep >= step.number ? 'text-blue-600' : 'text-gray-400'}`}
                onClick={() => setCurrentStep(step.number)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  currentStep >= step.number ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
                }`}>
                  {step.number}
                </div>
                <span className="text-xs mt-1">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 flex items-center">
                  <div className={`h-0.5 w-full ${
                    currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Image Upload */}
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="pt-6">
            <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              Upload Product Image
              <span className="text-red-500 ml-1">*</span>
              <Info className="w-4 h-4 ml-2 text-gray-400" />
            </Label>
            <div className="text-center">
              {!uploadedImage ? (
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('product-image').click()}
                  className="w-full h-40 flex flex-col items-center justify-center bg-white border-2 border-dashed border-blue-200"
                >
                  <Upload className="w-8 h-8 mb-2 text-blue-500" />
                  <span className="text-gray-600 font-medium">Upload product image or CAD file</span>
                  <span className="text-sm text-gray-400 mt-1">AI will analyze your product</span>
                </Button>
              ) : (
                <div className="relative w-full h-40">
                  <img
                    src={uploadedImage}
                    alt="Uploaded product"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Input
                id="product-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          </CardContent>
        </Card>

        {/* Main Form */}
        <Card>
          <CardContent className="pt-6">
            {renderStepContent()}
            
            {/* Navigation Buttons */}
            <div className="mt-6 flex justify-between">
              {currentStep > 1 && (
                <Button
                  variant="outline"
                  className="px-4 py-2 h-10"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                >
                  Previous
                </Button>
              )}
              {currentStep < 5 ? (
                <Button
                  className="ml-auto px-4 py-2 h-10"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  className="ml-auto px-4 py-2 h-10"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Design'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add result display */}
        {generatedResult && renderDesignResult()}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default PackagingLanding;