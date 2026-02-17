import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendData {
  date: string;
  amount: number;
}

interface SpendingTrendChartProps {
  data: TrendData[];
}

const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
        No spending data for this period
      </div>
    );
  }

  // Format data for display
  const formattedData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    amount: item.amount,
    fullDate: item.date
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#111' }}>
            {new Date(payload[0].payload.fullDate).toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'long',
              year: 'numeric'
            })}
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#dc2626', fontSize: '14px', fontWeight: 500 }}>
            Spent: ₹{payload[0].value.toLocaleString('en-IN')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12, fill: '#666' }}
          stroke="#9ca3af"
        />
        <YAxis 
          tick={{ fontSize: 12, fill: '#666' }}
          stroke="#9ca3af"
          tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
          formatter={() => 'Daily Spending'}
        />
        <Line 
          type="monotone" 
          dataKey="amount" 
          stroke="#dc2626" 
          strokeWidth={2}
          dot={{ fill: '#dc2626', r: 4 }}
          activeDot={{ r: 6 }}
          name="Daily Spending"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SpendingTrendChart;
