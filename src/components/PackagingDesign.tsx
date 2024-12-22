import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

const PackagingDesign = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { design } = location.state || {};

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Form
          </Button>
        </div>

        <h1 className="text-3xl font-semibold text-gray-900 mb-8 text-center">
          Packaging Design Solution
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="prose max-w-none whitespace-pre-wrap">
            {design}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackagingDesign; 