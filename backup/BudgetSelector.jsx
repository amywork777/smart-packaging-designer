import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const BudgetSelector = ({ quantity = 1, onBudgetChange }) => {
  const [mode, setMode] = useState('total');
  const [minTotalBudget, setMinTotalBudget] = useState(0);
  const [maxTotalBudget, setMaxTotalBudget] = useState(0);

  const minPerUnit = quantity > 0 ? minTotalBudget / quantity : 0;
  const maxPerUnit = quantity > 0 ? maxTotalBudget / quantity : 0;

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setMinTotalBudget(0);
    setMaxTotalBudget(0);
  };

  const handleBudgetChange = (value, type) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    const parsedValue = parseFloat(numericValue) || 0;

    if (type === 'min') {
      setMinTotalBudget(parsedValue);
    } else {
      setMaxTotalBudget(parsedValue);
    }
    
    onBudgetChange({
      mode,
      minTotal: type === 'min' ? parsedValue : minTotalBudget,
      maxTotal: type === 'max' ? parsedValue : maxTotalBudget,
      minPerUnit: minPerUnit,
      maxPerUnit: maxPerUnit
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Button
          type="button"
          variant={mode === 'total' ? 'default' : 'outline'}
          className="flex-1 h-14 text-lg font-medium"
          onClick={() => handleModeChange('total')}
        >
          Total Budget
        </Button>
        <Button
          type="button"
          variant={mode === 'perUnit' ? 'default' : 'outline'}
          className="flex-1 h-14 text-lg font-medium"
          onClick={() => handleModeChange('perUnit')}
        >
          Per Unit Budget
        </Button>
      </div>

      {!quantity && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-yellow-800">
          Please enter a quantity in Step 1 to see budget calculations
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <Label className="text-sm font-medium">
            {mode === 'total' ? 'Minimum Total Budget (USD)' : 'Minimum Per Unit Budget (USD)'}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
            <Input
              type="text"
              value={formatCurrency(mode === 'total' ? minTotalBudget : minPerUnit).replace('$', '')}
              onChange={(e) => handleBudgetChange(e.target.value, 'min')}
              className="pl-8 h-14 text-lg"
              placeholder="0.00"
            />
          </div>
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-md">
            <span className="text-sm text-blue-800">
              {mode === 'total' 
                ? `Per Unit: ${formatCurrency(minPerUnit)}`
                : `Total: ${formatCurrency(minTotalBudget)}`}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-medium">
            {mode === 'total' ? 'Maximum Total Budget (USD)' : 'Maximum Per Unit Budget (USD)'}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
            <Input
              type="text"
              value={formatCurrency(mode === 'total' ? maxTotalBudget : maxPerUnit).replace('$', '')}
              onChange={(e) => handleBudgetChange(e.target.value, 'max')}
              className="pl-8 h-14 text-lg"
              placeholder="0.00"
            />
          </div>
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-md">
            <span className="text-sm text-blue-800">
              {mode === 'total'
                ? `Per Unit: ${formatCurrency(maxPerUnit)}`
                : `Total: ${formatCurrency(maxTotalBudget)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetSelector; 