import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface DesignData {
  materialsSelection?: string;
  packagingMethodology?: string;
  billOfMaterials?: string;
  costSummary?: string;
  sourcing?: string;
  weightAndVolume?: string;
  testingAndValidation?: string;
  sustainabilityFeatures?: string;
  compliance?: string;
  customerExperience?: string;
  [key: string]: string | undefined;
}

interface LocationState {
  design: DesignData;
  productInfo: any;
}

const DesignPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { design, productInfo } = (location.state as LocationState) || {};

  if (!design) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">No design data available</h1>
          <Button variant="default" onClick={() => navigate('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const sections = [
    {
      title: "Materials Selection",
      content: design?.materialsSelection || ''
    },
    {
      title: "Packaging Methodology",
      content: design?.packagingMethodology || ''
    },
    {
      title: "Bill of Materials (BOM)",
      content: design?.billOfMaterials || ''
    },
    {
      title: "Cost Summary",
      content: design?.costSummary || ''
    },
    {
      title: "Sourcing",
      content: design?.sourcing || ''
    },
    {
      title: "Weight and Volume",
      content: design?.weightAndVolume || ''
    },
    {
      title: "Testing and Validation",
      content: design?.testingAndValidation || ''
    },
    {
      title: "Sustainability Features",
      content: design?.sustainabilityFeatures || ''
    },
    {
      title: "Compliance",
      content: design?.compliance || ''
    },
    {
      title: "Customer Experience",
      content: design?.customerExperience || ''
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="outline" 
          className="mb-6"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span>Back to Form</span>
        </Button>

        <h1 className="text-3xl font-semibold text-center mb-8">Packaging Design Solution</h1>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-lg border p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">{section.title}</h2>
              <div className="prose max-w-none whitespace-pre-wrap">
                {section.content.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="text-gray-600 mb-2">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DesignPage; 