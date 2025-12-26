"use client"

import { useState, useMemo, useEffect } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Tooltip, Area, ComposedChart } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { MonthlySalesF } from "@/app/types";
import { formatNumberEnglishStyle } from "@/lib/utils";
import ExportButton from "@/components/ui/ExportButton";

interface SalesByCategoryChartProps {
    salesData: MonthlySalesF[];
}

const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type PredictionMethod = "linear" | "exponential" | "seasonal" | "moving-average" | "polynomial" | "weighted-moving-average" | "exponential-smoothing" | "arima" | "holt-winters";

interface PredictionMethodInfo {
    value: PredictionMethod;
    label: string;
    description: string;
}

const predictionMethods: PredictionMethodInfo[] = [
    {
        value: "linear",
        label: "Linear Regression",
        description: "Simple trending line based on historical growth"
    },
    {
        value: "polynomial",
        label: "Polynomial Regression",
        description: "Curved trend line for non-linear patterns"
    },
    {
        value: "exponential",
        label: "Exponential Growth",
        description: "Accelerating or decelerating growth pattern"
    },
    {
        value: "moving-average",
        label: "Simple Moving Average",
        description: "Average of last 6 months with trend"
    },
    {
        value: "weighted-moving-average",
        label: "Weighted Moving Average",
        description: "Recent months weighted more heavily"
    },
    {
        value: "exponential-smoothing",
        label: "Exponential Smoothing",
        description: "Smoothed forecast with trend adjustment"
    },
    {
        value: "seasonal",
        label: "Seasonal Decomposition",
        description: "Pattern based on historical seasonality"
    },
    {
        value: "holt-winters",
        label: "Holt-Winters",
        description: "Advanced seasonal forecasting with trend"
    },
    {
        value: "arima",
        label: "ARIMA (Auto-Regressive)",
        description: "Statistical model for time series data"
    }
];

// Linear regression prediction
const linearPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const n = historicalData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    historicalData.forEach((item, index) => {
        sumX += index;
        sumY += item.totalAmount;
        sumXY += index * item.totalAmount;
        sumXX += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let index = n;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const predictedValue = slope * index + intercept;
        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
        index++;
    }

    return predictions;
};

// Polynomial regression prediction (degree 2)
const polynomialPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const n = historicalData.length;

    // Build matrices for polynomial regression (degree 2)
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;

    historicalData.forEach((item, index) => {
        const x = index;
        const x2 = x * x;
        const x3 = x2 * x;
        const x4 = x2 * x2;
        const y = item.totalAmount;

        sumX += x;
        sumX2 += x2;
        sumX3 += x3;
        sumX4 += x4;
        sumY += y;
        sumXY += x * y;
        sumX2Y += x2 * y;
    });

    // Solve system of equations for a, b, c in: y = a + bx + cx²
    const denom = n * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);

    const a = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY * sumX4 - sumX2Y * sumX3) + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / denom;
    const b = (n * (sumXY * sumX4 - sumX2Y * sumX3) - sumY * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y - sumX2 * sumXY)) / denom;
    const c = (n * (sumX2 * sumX2Y - sumX3 * sumXY) - sumX * (sumX * sumX2Y - sumX2 * sumXY) + sumY * (sumX * sumX3 - sumX2 * sumX2)) / denom;

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let index = n;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const predictedValue = a + b * index + c * index * index;
        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
        index++;
    }

    return predictions;
};

// Exponential prediction
const exponentialPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    // Calculate exponential growth rate
    const n = historicalData.length;
    const firstValue = historicalData[0].totalAmount;
    const lastValue = historicalData[n - 1].totalAmount;

    // Average monthly growth rate
    const growthRate = Math.pow(lastValue / firstValue, 1 / n);

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let monthsAhead = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        monthsAhead++;

        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const predictedValue = lastValue * Math.pow(growthRate, monthsAhead);
        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
    }

    return predictions;
};

// Seasonal pattern prediction
const seasonalPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    // Calculate monthly averages for seasonality
    const monthlyStats: { [key: number]: number[] } = {};
    for (let m = 1; m <= 12; m++) {
        monthlyStats[m] = [];
    }

    historicalData.forEach(item => {
        monthlyStats[item.month].push(item.totalAmount);
    });

    // Calculate average for each month
    const monthlyAvg: { [key: number]: number } = {};
    for (let m = 1; m <= 12; m++) {
        const values = monthlyStats[m];
        monthlyAvg[m] = values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : 0;
    }

    // Calculate overall trend
    const n = historicalData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    historicalData.forEach((item, index) => {
        sumX += index;
        sumY += item.totalAmount;
        sumXY += index * item.totalAmount;
        sumXX += index * index;
    });

    const trendSlope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgSales = sumY / n;
    const monthlyGrowth = (trendSlope / avgSales) * 100;

    // Generate predictions
    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let monthsAhead = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        monthsAhead++;

        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const seasonalSales = monthlyAvg[currentMonth] || avgSales;
        const trendMultiplier = Math.pow(1 + (monthlyGrowth / 100), monthsAhead);
        const predictedSales = seasonalSales * trendMultiplier;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedSales),
            isPredicted: true
        });
    }

    return predictions;
};

// Moving average prediction
const movingAveragePrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const windowSize = Math.min(6, historicalData.length);
    const recentData = historicalData.slice(-windowSize);

    // Calculate moving average
    const movingAvg = recentData.reduce((sum, item) => sum + item.totalAmount, 0) / windowSize;

    // Calculate trend from recent data
    const n = recentData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    recentData.forEach((item, index) => {
        sumX += index;
        sumY += item.totalAmount;
        sumXY += index * item.totalAmount;
        sumXX += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let monthsAhead = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        monthsAhead++;

        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const predictedValue = movingAvg + (slope * monthsAhead);
        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
    }

    return predictions;
};

// Weighted moving average prediction
const weightedMovingAveragePrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const windowSize = Math.min(6, historicalData.length);
    const recentData = historicalData.slice(-windowSize);

    // Calculate weighted average (more weight on recent data)
    let weightedSum = 0;
    let weightSum = 0;
    recentData.forEach((item, index) => {
        const weight = index + 1; // Linear weights: 1, 2, 3, 4, 5, 6
        weightedSum += item.totalAmount * weight;
        weightSum += weight;
    });
    const weightedAvg = weightedSum / weightSum;

    // Calculate trend from recent data
    const n = recentData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    recentData.forEach((item, index) => {
        sumX += index;
        sumY += item.totalAmount;
        sumXY += index * item.totalAmount;
        sumXX += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let monthsAhead = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        monthsAhead++;

        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const predictedValue = weightedAvg + (slope * monthsAhead);
        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
    }

    return predictions;
};

// Exponential smoothing prediction (Double Exponential Smoothing / Holt's method)
const exponentialSmoothingPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const alpha = 0.3; // Level smoothing factor
    const beta = 0.1;  // Trend smoothing factor

    // Initialize
    let level = historicalData[0].totalAmount;
    let trend = historicalData.length > 1
        ? (historicalData[1].totalAmount - historicalData[0].totalAmount)
        : 0;

    // Calculate smoothed values
    for (let i = 1; i < historicalData.length; i++) {
        const value = historicalData[i].totalAmount;
        const lastLevel = level;

        level = alpha * value + (1 - alpha) * (level + trend);
        trend = beta * (level - lastLevel) + (1 - beta) * trend;
    }

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let monthsAhead = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        monthsAhead++;

        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const predictedValue = level + monthsAhead * trend;
        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
    }

    return predictions;
};

// Holt-Winters prediction (Triple Exponential Smoothing with seasonality)
const holtWintersPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const alpha = 0.3; // Level
    const beta = 0.1;  // Trend
    const gamma = 0.2; // Seasonality
    const seasonLength = 12;

    if (historicalData.length < seasonLength) {
        return exponentialSmoothingPrediction(historicalData, targetYear, targetMonth);
    }

    // Initialize seasonal components
    const seasonal: number[] = new Array(seasonLength).fill(0);

    // Calculate initial seasonal indices
    for (let i = 0; i < seasonLength && i < historicalData.length; i++) {
        seasonal[i] = historicalData[i].totalAmount / (historicalData.reduce((sum, d) => sum + d.totalAmount, 0) / historicalData.length);
    }

    let level = historicalData[0].totalAmount / seasonal[0];
    let trend = 0;

    // Update components
    for (let i = 1; i < historicalData.length; i++) {
        const value = historicalData[i].totalAmount;
        const seasonalIdx = i % seasonLength;

        const lastLevel = level;
        level = alpha * (value / seasonal[seasonalIdx]) + (1 - alpha) * (level + trend);
        trend = beta * (level - lastLevel) + (1 - beta) * trend;
        seasonal[seasonalIdx] = gamma * (value / level) + (1 - gamma) * seasonal[seasonalIdx];
    }

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;
    let monthsAhead = 0;

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        monthsAhead++;

        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        const seasonalIdx = (currentMonth - 1) % seasonLength;
        const predictedValue = (level + monthsAhead * trend) * seasonal[seasonalIdx];

        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });
    }

    return predictions;
};

// ARIMA-like prediction (simplified auto-regressive model)
const arimaPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const p = 3; // AR order (use last 3 values)

    if (historicalData.length < p + 1) {
        return linearPrediction(historicalData, targetYear, targetMonth);
    }

    // Calculate AR coefficients using least squares
    const n = historicalData.length - p;
    const X: number[][] = [];
    const y: number[] = [];

    for (let i = p; i < historicalData.length; i++) {
        const row = [];
        for (let j = 0; j < p; j++) {
            row.push(historicalData[i - j - 1].totalAmount);
        }
        X.push(row);
        y.push(historicalData[i].totalAmount);
    }

    // Simple coefficient estimation (using averages)
    const coefficients: number[] = [];
    for (let j = 0; j < p; j++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (X[i][j] / y[i]);
        }
        coefficients.push(sum / n);
    }

    // Normalize coefficients
    const sumCoef = coefficients.reduce((a, b) => a + b, 0);
    const normalizedCoef = coefficients.map(c => c / sumCoef);

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;

    // Keep recent values for prediction
    const recentValues = historicalData.slice(-p).map(d => d.totalAmount);

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        // Predict next value
        let predictedValue = 0;
        for (let j = 0; j < p; j++) {
            predictedValue += recentValues[recentValues.length - 1 - j] * normalizedCoef[j];
        }

        predictions.push({
            year: currentYear,
            month: currentMonth,
            totalAmount: Math.max(0, predictedValue),
            isPredicted: true
        });

        // Update recent values
        recentValues.shift();
        recentValues.push(predictedValue);
    }

    return predictions;
};

// Main prediction function
const generateSalesPredictions = (
    historicalData: any[],
    targetYear: number,
    targetMonth: number,
    method: PredictionMethod
) => {
    if (historicalData.length < 3) {
        return [];
    }

    const lastData = historicalData[historicalData.length - 1];

    // Only predict for future dates
    if (targetYear < lastData.year || (targetYear === lastData.year && targetMonth <= lastData.month)) {
        return [];
    }

    switch (method) {
        case "linear":
            return linearPrediction(historicalData, targetYear, targetMonth);
        case "polynomial":
            return polynomialPrediction(historicalData, targetYear, targetMonth);
        case "exponential":
            return exponentialPrediction(historicalData, targetYear, targetMonth);
        case "seasonal":
            return seasonalPrediction(historicalData, targetYear, targetMonth);
        case "moving-average":
            return movingAveragePrediction(historicalData, targetYear, targetMonth);
        case "weighted-moving-average":
            return weightedMovingAveragePrediction(historicalData, targetYear, targetMonth);
        case "exponential-smoothing":
            return exponentialSmoothingPrediction(historicalData, targetYear, targetMonth);
        case "holt-winters":
            return holtWintersPrediction(historicalData, targetYear, targetMonth);
        case "arima":
            return arimaPrediction(historicalData, targetYear, targetMonth);
        default:
            return linearPrediction(historicalData, targetYear, targetMonth);
    }
};

const SalesByCategoryChart = ({ salesData }: SalesByCategoryChartProps) => {
    const categories = useMemo(() => Array.from(new Set(salesData.map(d => d.category))), [salesData]);
    const [selectedCategory, setSelectedCategory] = useState<string | "Total">("Total");
    const [enablePrediction, setEnablePrediction] = useState(false);
    const [predictionMonths, setPredictionMonths] = useState<number>(6); // Number of months to predict
    const [predictionMethod, setPredictionMethod] = useState<PredictionMethod>("linear");

    const sortedData = useMemo(() => salesData.sort((a, b) => a.year - b.year || a.month - b.month), [salesData]);

    const completeMonths = useMemo(() => {
        if (sortedData.length <= 2) return [];
        return sortedData.slice(1, sortedData.length - 1);
    }, [sortedData]);

    const aggregatedData = useMemo(() => {
        const map = new Map<string, { year: number; month: number; totalAmount: number; category?: string; isPredicted: boolean }>();

        completeMonths.forEach(d => {
            if (selectedCategory === "Total") {
                const key = `${d.year}-${d.month}`;
                const entry = map.get(key);
                if (entry) entry.totalAmount += d.totalAmount;
                else map.set(key, { year: d.year, month: d.month, totalAmount: d.totalAmount, isPredicted: false });
            } else if (d.category === selectedCategory) {
                const key = `${d.year}-${d.month}`;
                const entry = map.get(key);
                if (entry) entry.totalAmount += d.totalAmount;
                else map.set(key, { year: d.year, month: d.month, totalAmount: d.totalAmount, category: d.category, isPredicted: false });
            }
        });

        return Array.from(map.values()).sort((a, b) => a.year - b.year || a.month - b.month);
    }, [completeMonths, selectedCategory]);

    // Generate predictions
    const dataWithPredictions = useMemo(() => {
        if (!enablePrediction || predictionMonths === 0 || aggregatedData.length === 0) {
            return aggregatedData;
        }

        const lastData = aggregatedData[aggregatedData.length - 1];

        // Calculate target date based on prediction months
        let targetYear = lastData.year;
        let targetMonth = lastData.month + predictionMonths;

        while (targetMonth > 12) {
            targetMonth -= 12;
            targetYear++;
        }

        const predictions = generateSalesPredictions(aggregatedData, targetYear, targetMonth, predictionMethod);

        // Add category if needed
        const predictionsWithCategory = predictions.map(p => ({
            ...p,
            ...(selectedCategory !== "Total" && { category: selectedCategory })
        }));

        return [...aggregatedData, ...predictionsWithCategory];
    }, [aggregatedData, enablePrediction, predictionMonths, predictionMethod, selectedCategory]);

    const [rangeValues, setRangeValues] = useState<number[]>([0, Math.max(0, dataWithPredictions.length - 1)]);

    // Update range when data changes
    useEffect(() => {
        if (dataWithPredictions.length > 0) {
            setRangeValues([0, dataWithPredictions.length - 1]);
        }
    }, [dataWithPredictions.length]);

    const displayedData = useMemo(() => {
        const sliced = dataWithPredictions.slice(rangeValues[0], rangeValues[1] + 1);
        return sliced;
    }, [dataWithPredictions, rangeValues]);

    const seasonalTotals = useMemo(() => {
        const seasons = { Winter: 0, Spring: 0, Summer: 0, Fall: 0 };
        const data = displayedData.filter(v => v.year === 2023 && !v.isPredicted)

        data.forEach(d => {
            if ([12, 1, 2].includes(d.month)) seasons.Winter += d.totalAmount;
            else if ([3, 4, 5].includes(d.month)) seasons.Spring += d.totalAmount;
            else if ([6, 7, 8].includes(d.month)) seasons.Summer += d.totalAmount;
            else seasons.Fall += d.totalAmount;
        });
        return seasons;
    }, [displayedData]);

    const getSeasonMessage = () => {
        const entries = Object.entries(seasonalTotals).sort((a, b) => b[1] - a[1]);
        if (entries[0][1] === 0) return "No 2023 data available for seasonal analysis";
        return `Peak season: ${entries[0][0]} | Low season: ${entries[entries.length - 1][0]}`;
    };

    const lineColor = useMemo(() => {
        if (selectedCategory === "Total") return colors[0];
        const index = categories.findIndex(c => c === selectedCategory);
        return colors[index % colors.length];
    }, [selectedCategory, categories]);

    const getMaxAndMinSale = () => {
        const data = displayedData.filter(v => {
            return !v.isPredicted && !(v.year === 2022 && v.month === 6 || v.year === 2024 && v.month === 6);
        });

        if (data.length === 0) return "No data available";

        const maxValue = Math.max(...data.map(obj => obj.totalAmount));
        const minValue = Math.min(...data.map(obj => obj.totalAmount));
        const objOfMax = data.filter(v => v.totalAmount === maxValue);
        const objOfMin = data.filter(v => v.totalAmount === minValue);

        return `The max value was of $${formatNumberEnglishStyle(Math.round(maxValue))} in ${monthNames[objOfMax[0].month - 1]} ${objOfMax[0].year} . The min value was of $${formatNumberEnglishStyle(Math.round(minValue))} in ${monthNames[objOfMin[0].month - 1]} ${objOfMin[0].year}`;
    }

    const handleExport = async () => {
        try {
            const exportData = displayedData.map(item => ({
                monthYear: `${monthNames[item.month - 1]} ${item.year}`,
                year: item.year,
                month: item.month,
                totalAmount: item.totalAmount,
                isPredicted: item.isPredicted || false
            }));

            const dateRange = displayedData.length > 0
                ? `${monthNames[displayedData[0].month - 1]} ${displayedData[0].year} - ${monthNames[displayedData[displayedData.length - 1].month - 1]} ${displayedData[displayedData.length - 1].year}`
                : 'N/A';

            const response = await fetch('/api/export-sales-chart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    displayedData: exportData,
                    selectedCategory,
                    dateRange,
                    seasonalAnalysis: getSeasonMessage(),
                    maxMinInfo: getMaxAndMinSale(),
                    lineColor,
                    hasPredictions: enablePrediction && predictionMonths > 0,
                    predictionMethod: predictionMethod,
                    predictionMonths: predictionMonths
                })
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = enablePrediction
                ? `sales-trends-${selectedCategory.replace(/\s+/g, '-')}-with-predictions-${predictionMethod}-${new Date().toISOString().split('T')[0]}.xlsx`
                : `sales-trends-${selectedCategory.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
        }
    };

    const predictionCount = displayedData.filter(d => d.isPredicted).length;
    const selectedMethodInfo = predictionMethods.find(m => m.value === predictionMethod);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1">
                    <CardTitle>Sales Trends by Category</CardTitle>
                    <CardDescription>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="bg-black z-100">
                                <SelectItem value="Total">Total</SelectItem>
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </CardDescription>
                </div>
                <ExportButton onExport={handleExport} />
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Prediction Controls */}
                <div className="flex flex-wrap gap-4 items-end p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="enablePrediction"
                            checked={enablePrediction}
                            onChange={(e) => setEnablePrediction(e.target.checked)}
                            className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="enablePrediction" className="text-sm font-medium cursor-pointer">
                            Enable Prediction
                        </label>
                    </div>

                    {enablePrediction && (
                        <>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-medium">Prediction Method</label>
                                <Select value={predictionMethod} onValueChange={(val: PredictionMethod) => setPredictionMethod(val)}>
                                    <SelectTrigger className="w-48 bg-white dark:bg-slate-900">
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900 z-50">
                                        {predictionMethods.map(method => (
                                            <SelectItem key={method.value} value={method.value}>
                                                {method.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedMethodInfo && (
                                    <p className="text-xs text-muted-foreground">{selectedMethodInfo.description}</p>
                                )}
                            </div>

                            <div className="flex flex-col space-y-2 flex-1 min-w-[250px]  bg-blue-900 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium">Prediction Period</label>
                                    <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                        {predictionMonths} month{predictionMonths !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <Slider
                                    min={1}
                                    max={24}
                                    step={1}
                                    value={[predictionMonths]}
                                    onValueChange={(values) => setPredictionMonths(values[0])}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>1 month</span>
                                    <span>24 months</span>
                                </div>
                            </div>

                            {predictionCount > 0 && (
                                <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                    Showing {predictionCount} predicted month{predictionCount > 1 ? 's' : ''}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="flex gap-2 mb-2 text-xs text-muted-foreground justify-between">
                    <span>{displayedData[0] ? `${monthNames[displayedData[0].month - 1]} ${displayedData[0].year}` : ""}</span>
                    <span>{displayedData[displayedData.length - 1] ? `${monthNames[displayedData[displayedData.length - 1].month - 1]} ${displayedData[displayedData.length - 1].year}` : ""}</span>
                </div>

                <Slider
                    min={0}
                    max={Math.max(0, dataWithPredictions.length - 1)}
                    step={1}
                    value={rangeValues}
                    onValueChange={setRangeValues}
                    className="w-full"
                />

                <ChartContainer config={{ desktop: { label: "Sales by Category", color: "from-green-600 to-blue-600" } }}>
                    <ComposedChart
                        data={displayedData}
                        margin={{ left: 40, right: 24 }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey={d => `${monthNames[d.month - 1]} ${d.year}`}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                        <YAxis
                            tickFormatter={(value) => {
                                if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                                if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
                                return `$${value}`;
                            }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const data = payload[0].payload;
                                return (
                                    <div className="bg-neutral-200 text-black border rounded-lg shadow-lg p-3">
                                        <p className="font-medium mb-1">
                                            {`${monthNames[data.month - 1]} ${data.year}`}
                                            {data.isPredicted && <span className="ml-2 text-xs text-purple-600">(Predicted)</span>}
                                        </p>
                                        <p className="text-sm">
                                            ${Number(data.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                );
                            }}
                        />

                        {/* Area for predicted region */}
                        {enablePrediction && (
                            <Area
                                dataKey="totalAmount"
                                fill={lineColor}
                                fillOpacity={0.1}
                                stroke="none"
                                isAnimationActive={false}
                            />
                        )}

                        <Line
                            name="Total Amount"
                            dataKey="totalAmount"
                            type="monotone"
                            stroke={lineColor}
                            strokeWidth={2}
                            dot={(props: any) => {
                                const { cx, cy, payload, index } = props;
                                if (!payload) return <></>;
                                const isPred = payload.isPredicted;
                                return (
                                    <circle
                                        key={`dot-${index}`}
                                        cx={cx}
                                        cy={cy}
                                        r={isPred ? 6 : 3}
                                        fill={isPred ? '#a855f7' : lineColor}
                                        stroke={isPred ? '#7c3aed' : lineColor}
                                        strokeWidth={isPred ? 2 : 0}
                                    />
                                );
                            }}
                        />
                    </ComposedChart>
                </ChartContainer>
            </CardContent>

            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div>{getSeasonMessage()}</div>
                <div>{getMaxAndMinSale()}</div>
                {predictionCount > 0 && (
                    <div className="text-muted-foreground text-xs">
                        Note: Predictions using {selectedMethodInfo?.label} method are estimates and should be used for planning purposes only.
                    </div>
                )}
            </CardFooter>
        </Card>
    );
};

export default SalesByCategoryChart;