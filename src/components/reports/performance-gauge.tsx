"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface PerformanceGaugeProps {
  value: number; // 0 to 100
  label?: string;
}

const COLORS = {
  green: 'hsl(var(--chart-3))', // Good score
  orange: '#F97316', // Average score
  red: 'hsl(var(--destructive))', // Poor score
  background: 'hsl(var(--muted))',
};

export const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({ value, label }) => {
  const score = Math.max(0, Math.min(100, value));
  const data = [
    { name: 'score', value: score },
    { name: 'empty', value: 100 - score },
  ];

  const scoreColor = score >= 90 ? COLORS.green : score >= 50 ? COLORS.orange : COLORS.red;

  return (
    <div className="relative w-48 h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={90}
            endAngle={-270}
            innerRadius="75%"
            outerRadius="100%"
            dataKey="value"
            stroke="none"
            cornerRadius={10}
          >
            <Cell fill={scoreColor} />
            <Cell fill={COLORS.background} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold font-headline" style={{ color: scoreColor }}>
          {score}
        </span>
        {label && <p className="text-md font-semibold text-muted-foreground mt-1">{label}</p>}
      </div>
    </div>
  );
};
