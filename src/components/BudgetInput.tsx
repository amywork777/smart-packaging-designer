import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';

interface BudgetInputProps {
  quantity: number;
  onBudgetChange: (budget: any) => void;
}

const BudgetInput = ({ quantity, onBudgetChange }: BudgetInputProps) => {
  const [budget, setBudget] = useState({
    minTotal: '',
    maxTotal: ''
  });

  const handleBudgetChange = (field: string, value: string) => {
    const newBudget = {
      ...budget,
      [field]: value
    };
    setBudget(newBudget);

    onBudgetChange({
      [field]: value,
      perUnit: calculatePerUnit(value)
    });
  };

  const calculatePerUnit = (total: string): string => {
    if (!total || !quantity || quantity <= 0) return '0.00';
    return (parseFloat(total) / quantity).toFixed(2);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Minimum Total Budget (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget.minTotal}
                  onChange={(e) => handleBudgetChange('minTotal', e.target.value)}
                  className="pl-7 h-12"
                  placeholder="0.00"
                />
              </div>
              <div className="text-sm text-blue-600">
                Per Unit: ${calculatePerUnit(budget.minTotal)}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Maximum Total Budget (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budget.maxTotal}
                  onChange={(e) => handleBudgetChange('maxTotal', e.target.value)}
                  className="pl-7 h-12"
                  placeholder="0.00"
                />
              </div>
              <div className="text-sm text-blue-600">
                Per Unit: ${calculatePerUnit(budget.maxTotal)}
              </div>
            </div>
          </div>

          {parseFloat(budget.maxTotal) < parseFloat(budget.minTotal) && (
            <div className="text-red-600 text-sm">
              Maximum budget must be greater than minimum budget
            </div>
          )}

          <div className="text-sm text-gray-500 text-center">
            Calculating for {quantity} {quantity === 1 ? 'unit' : 'units'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetInput; 