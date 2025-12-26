"use client"

import { CartesianGrid, Line, Tooltip, XAxis, YAxis, Legend, ReferenceLine, Bar, ComposedChart, Cell } from "recharts"
import { useState, useMemo, useEffect } from "react"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
} from "@/components/ui/chart"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MonthlyStats } from "@/app/types"
import ExportButton from "@/components/ui/ExportButton"

export const description = "Highlighting the link between price changes and sales evolution";

type PredictionMethod = "linear" | "exponential" | "seasonal" | "moving-average" | "polynomial" | "weighted-moving-average" | "exponential-smoothing" | "holt-winters" | "arima";

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

const chartConfig = {
    priceChange: {
        label: "Price Change %",
        color: "hsl(var(--chart-1))",
    },
    salesChange: {
        label: "Sales Change %",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

interface SalesChartProps {
    chartData: MonthlyStats[],
}

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Linear regression prediction
const linearPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const n = historicalData.length;
    let sumX = 0, sumY_price = 0, sumY_sales = 0, sumXY_price = 0, sumXY_sales = 0, sumXX = 0;

    historicalData.forEach((item, index) => {
        sumX += index;
        sumY_price += item.avgPrice;
        sumY_sales += item.totalAmount;
        sumXY_price += index * item.avgPrice;
        sumXY_sales += index * item.totalAmount;
        sumXX += index * index;
    });

    const slope_price = (n * sumXY_price - sumX * sumY_price) / (n * sumXX - sumX * sumX);
    const intercept_price = (sumY_price - slope_price * sumX) / n;
    const slope_sales = (n * sumXY_sales - sumX * sumY_sales) / (n * sumXX - sumX * sumX);
    const intercept_sales = (sumY_sales - slope_sales * sumX) / n;

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

        const predictedPrice = slope_price * index + intercept_price;
        const predictedSales = slope_sales * index + intercept_sales;

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
        index++;
    }

    return predictions;
};

// Polynomial regression prediction (degree 2)
const polynomialPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const n = historicalData.length;

    // Build matrices for polynomial regression (degree 2) for both price and sales
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY_price = 0, sumXY_price = 0, sumX2Y_price = 0;
    let sumY_sales = 0, sumXY_sales = 0, sumX2Y_sales = 0;

    historicalData.forEach((item, index) => {
        const x = index;
        const x2 = x * x;
        const x3 = x2 * x;
        const x4 = x2 * x2;

        sumX += x;
        sumX2 += x2;
        sumX3 += x3;
        sumX4 += x4;
        sumY_price += item.avgPrice;
        sumXY_price += x * item.avgPrice;
        sumX2Y_price += x2 * item.avgPrice;
        sumY_sales += item.totalAmount;
        sumXY_sales += x * item.totalAmount;
        sumX2Y_sales += x2 * item.totalAmount;
    });

    // Solve for price coefficients
    const denom = n * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);
    const a_price = (sumY_price * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY_price * sumX4 - sumX2Y_price * sumX3) + sumX2 * (sumXY_price * sumX3 - sumX2Y_price * sumX2)) / denom;
    const b_price = (n * (sumXY_price * sumX4 - sumX2Y_price * sumX3) - sumY_price * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y_price - sumX2 * sumXY_price)) / denom;
    const c_price = (n * (sumX2 * sumX2Y_price - sumX3 * sumXY_price) - sumX * (sumX * sumX2Y_price - sumX2 * sumXY_price) + sumY_price * (sumX * sumX3 - sumX2 * sumX2)) / denom;

    // Solve for sales coefficients
    const a_sales = (sumY_sales * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY_sales * sumX4 - sumX2Y_sales * sumX3) + sumX2 * (sumXY_sales * sumX3 - sumX2Y_sales * sumX2)) / denom;
    const b_sales = (n * (sumXY_sales * sumX4 - sumX2Y_sales * sumX3) - sumY_sales * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y_sales - sumX2 * sumXY_sales)) / denom;
    const c_sales = (n * (sumX2 * sumX2Y_sales - sumX3 * sumXY_sales) - sumX * (sumX * sumX2Y_sales - sumX2 * sumXY_sales) + sumY_sales * (sumX * sumX3 - sumX2 * sumX2)) / denom;

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

        const predictedPrice = a_price + b_price * index + c_price * index * index;
        const predictedSales = a_sales + b_sales * index + c_sales * index * index;

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
        index++;
    }

    return predictions;
};

// Exponential prediction
const exponentialPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const n = historicalData.length;
    const firstPrice = historicalData[0].avgPrice;
    const lastPrice = historicalData[n - 1].avgPrice;
    const firstSales = historicalData[0].totalAmount;
    const lastSales = historicalData[n - 1].totalAmount;

    const growthRatePrice = Math.pow(lastPrice / firstPrice, 1 / n);
    const growthRateSales = Math.pow(lastSales / firstSales, 1 / n);

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

        const predictedPrice = lastPrice * Math.pow(growthRatePrice, monthsAhead);
        const predictedSales = lastSales * Math.pow(growthRateSales, monthsAhead);

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
    }

    return predictions;
};

// Seasonal pattern prediction
const seasonalPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    // Calculate monthly averages for seasonality
    const monthlyStats: { [key: number]: { prices: number[], sales: number[] } } = {};
    for (let m = 1; m <= 12; m++) {
        monthlyStats[m] = { prices: [], sales: [] };
    }

    historicalData.forEach(item => {
        monthlyStats[item.month].prices.push(item.avgPrice);
        monthlyStats[item.month].sales.push(item.totalAmount);
    });

    const monthlyAvg: { [key: number]: { avgPrice: number, avgSales: number } } = {};
    for (let m = 1; m <= 12; m++) {
        const prices = monthlyStats[m].prices;
        const sales = monthlyStats[m].sales;
        monthlyAvg[m] = {
            avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            avgSales: sales.length > 0 ? sales.reduce((a, b) => a + b, 0) / sales.length : 0
        };
    }

    // Calculate overall trend
    const n = historicalData.length;
    let sumX = 0, sumY_price = 0, sumY_sales = 0, sumXY_price = 0, sumXY_sales = 0, sumXX = 0;

    historicalData.forEach((item, index) => {
        sumX += index;
        sumY_price += item.avgPrice;
        sumY_sales += item.totalAmount;
        sumXY_price += index * item.avgPrice;
        sumXY_sales += index * item.totalAmount;
        sumXX += index * index;
    });

    const trendSlope_price = (n * sumXY_price - sumX * sumY_price) / (n * sumXX - sumX * sumX);
    const trendSlope_sales = (n * sumXY_sales - sumX * sumY_sales) / (n * sumXX - sumX * sumX);
    const avgPrice = sumY_price / n;
    const avgSales = sumY_sales / n;
    const monthlyGrowth_price = (trendSlope_price / avgPrice) * 100;
    const monthlyGrowth_sales = (trendSlope_sales / avgSales) * 100;

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

        const seasonalPrice = monthlyAvg[currentMonth].avgPrice || avgPrice;
        const seasonalSales = monthlyAvg[currentMonth].avgSales || avgSales;
        const trendMultiplier = Math.pow(1 + (monthlyGrowth_price / 100), monthsAhead);
        const trendMultiplier_sales = Math.pow(1 + (monthlyGrowth_sales / 100), monthsAhead);
        const predictedPrice = seasonalPrice * trendMultiplier;
        const predictedSales = seasonalSales * trendMultiplier_sales;

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
    }

    return predictions;
};

// Moving average prediction
const movingAveragePrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const windowSize = Math.min(6, historicalData.length);
    const recentData = historicalData.slice(-windowSize);

    const movingAvgPrice = recentData.reduce((sum, item) => sum + item.avgPrice, 0) / windowSize;
    const movingAvgSales = recentData.reduce((sum, item) => sum + item.totalAmount, 0) / windowSize;

    const n = recentData.length;
    let sumX = 0, sumY_price = 0, sumY_sales = 0, sumXY_price = 0, sumXY_sales = 0, sumXX = 0;

    recentData.forEach((item, index) => {
        sumX += index;
        sumY_price += item.avgPrice;
        sumY_sales += item.totalAmount;
        sumXY_price += index * item.avgPrice;
        sumXY_sales += index * item.totalAmount;
        sumXX += index * index;
    });

    const slopePrice = (n * sumXY_price - sumX * sumY_price) / (n * sumXX - sumX * sumX);
    const slopeSales = (n * sumXY_sales - sumX * sumY_sales) / (n * sumXX - sumX * sumX);

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

        const predictedPrice = movingAvgPrice + (slopePrice * monthsAhead);
        const predictedSales = movingAvgSales + (slopeSales * monthsAhead);

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
    }

    return predictions;
};

// Weighted moving average prediction
const weightedMovingAveragePrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const windowSize = Math.min(6, historicalData.length);
    const recentData = historicalData.slice(-windowSize);

    let weightedSumPrice = 0, weightedSumSales = 0, weightSum = 0;
    recentData.forEach((item, index) => {
        const weight = index + 1;
        weightedSumPrice += item.avgPrice * weight;
        weightedSumSales += item.totalAmount * weight;
        weightSum += weight;
    });
    const weightedAvgPrice = weightedSumPrice / weightSum;
    const weightedAvgSales = weightedSumSales / weightSum;

    const n = recentData.length;
    let sumX = 0, sumY_price = 0, sumY_sales = 0, sumXY_price = 0, sumXY_sales = 0, sumXX = 0;

    recentData.forEach((item, index) => {
        sumX += index;
        sumY_price += item.avgPrice;
        sumY_sales += item.totalAmount;
        sumXY_price += index * item.avgPrice;
        sumXY_sales += index * item.totalAmount;
        sumXX += index * index;
    });

    const slopePrice = (n * sumXY_price - sumX * sumY_price) / (n * sumXX - sumX * sumX);
    const slopeSales = (n * sumXY_sales - sumX * sumY_sales) / (n * sumXX - sumX * sumX);

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

        const predictedPrice = weightedAvgPrice + (slopePrice * monthsAhead);
        const predictedSales = weightedAvgSales + (slopeSales * monthsAhead);

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
    }

    return predictions;
};

// Exponential smoothing prediction
const exponentialSmoothingPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const alpha = 0.3, beta = 0.1;

    let levelPrice = historicalData[0].avgPrice;
    let trendPrice = historicalData.length > 1 ? (historicalData[1].avgPrice - historicalData[0].avgPrice) : 0;
    let levelSales = historicalData[0].totalAmount;
    let trendSales = historicalData.length > 1 ? (historicalData[1].totalAmount - historicalData[0].totalAmount) : 0;

    for (let i = 1; i < historicalData.length; i++) {
        const lastLevelPrice = levelPrice;
        const lastLevelSales = levelSales;

        levelPrice = alpha * historicalData[i].avgPrice + (1 - alpha) * (levelPrice + trendPrice);
        trendPrice = beta * (levelPrice - lastLevelPrice) + (1 - beta) * trendPrice;

        levelSales = alpha * historicalData[i].totalAmount + (1 - alpha) * (levelSales + trendSales);
        trendSales = beta * (levelSales - lastLevelSales) + (1 - beta) * trendSales;
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

        const predictedPrice = levelPrice + monthsAhead * trendPrice;
        const predictedSales = levelSales + monthsAhead * trendSales;

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
    }

    return predictions;
};

// Holt-Winters prediction
const holtWintersPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const alpha = 0.3, beta = 0.1, gamma = 0.2, seasonLength = 12;

    if (historicalData.length < seasonLength) {
        return exponentialSmoothingPrediction(historicalData, targetYear, targetMonth);
    }

    const seasonalPrice: number[] = new Array(seasonLength).fill(0);
    const seasonalSales: number[] = new Array(seasonLength).fill(0);

    for (let i = 0; i < seasonLength && i < historicalData.length; i++) {
        const avgPrice = historicalData.reduce((sum, d) => sum + d.avgPrice, 0) / historicalData.length;
        const avgSales = historicalData.reduce((sum, d) => sum + d.totalAmount, 0) / historicalData.length;
        seasonalPrice[i] = historicalData[i].avgPrice / avgPrice;
        seasonalSales[i] = historicalData[i].totalAmount / avgSales;
    }

    let levelPrice = historicalData[0].avgPrice / seasonalPrice[0];
    let trendPrice = 0;
    let levelSales = historicalData[0].totalAmount / seasonalSales[0];
    let trendSales = 0;

    for (let i = 1; i < historicalData.length; i++) {
        const seasonalIdx = i % seasonLength;

        const lastLevelPrice = levelPrice;
        levelPrice = alpha * (historicalData[i].avgPrice / seasonalPrice[seasonalIdx]) + (1 - alpha) * (levelPrice + trendPrice);
        trendPrice = beta * (levelPrice - lastLevelPrice) + (1 - beta) * trendPrice;
        seasonalPrice[seasonalIdx] = gamma * (historicalData[i].avgPrice / levelPrice) + (1 - gamma) * seasonalPrice[seasonalIdx];

        const lastLevelSales = levelSales;
        levelSales = alpha * (historicalData[i].totalAmount / seasonalSales[seasonalIdx]) + (1 - alpha) * (levelSales + trendSales);
        trendSales = beta * (levelSales - lastLevelSales) + (1 - beta) * trendSales;
        seasonalSales[seasonalIdx] = gamma * (historicalData[i].totalAmount / levelSales) + (1 - gamma) * seasonalSales[seasonalIdx];
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
        const predictedPrice = (levelPrice + monthsAhead * trendPrice) * seasonalPrice[seasonalIdx];
        const predictedSales = (levelSales + monthsAhead * trendSales) * seasonalSales[seasonalIdx];

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });
    }

    return predictions;
};

// ARIMA-like prediction
const arimaPrediction = (historicalData: any[], targetYear: number, targetMonth: number) => {
    const p = 3;

    if (historicalData.length < p + 1) {
        return linearPrediction(historicalData, targetYear, targetMonth);
    }

    const n = historicalData.length - p;
    const X: number[][] = [];
    const yPrice: number[] = [];
    const ySales: number[] = [];

    for (let i = p; i < historicalData.length; i++) {
        const row = [];
        for (let j = 0; j < p; j++) {
            row.push(historicalData[i - j - 1].avgPrice);
        }
        X.push(row);
        yPrice.push(historicalData[i].avgPrice);
        ySales.push(historicalData[i].totalAmount);
    }

    const coefficientsPrice: number[] = [];
    const coefficientsSales: number[] = [];
    for (let j = 0; j < p; j++) {
        let sumPrice = 0, sumSales = 0;
        for (let i = 0; i < n; i++) {
            sumPrice += (X[i][j] / yPrice[i]);
            sumSales += (historicalData[i + p - j - 1].totalAmount / ySales[i]);
        }
        coefficientsPrice.push(sumPrice / n);
        coefficientsSales.push(sumSales / n);
    }

    const sumCoefPrice = coefficientsPrice.reduce((a, b) => a + b, 0);
    const sumCoefSales = coefficientsSales.reduce((a, b) => a + b, 0);
    const normalizedCoefPrice = coefficientsPrice.map(c => c / sumCoefPrice);
    const normalizedCoefSales = coefficientsSales.map(c => c / sumCoefSales);

    const predictions = [];
    const lastData = historicalData[historicalData.length - 1];
    let currentYear = lastData.year;
    let currentMonth = lastData.month;

    const recentValuesPrice = historicalData.slice(-p).map(d => d.avgPrice);
    const recentValuesSales = historicalData.slice(-p).map(d => d.totalAmount);

    while (currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth)) {
        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        let predictedPrice = 0, predictedSales = 0;
        for (let j = 0; j < p; j++) {
            predictedPrice += recentValuesPrice[recentValuesPrice.length - 1 - j] * normalizedCoefPrice[j];
            predictedSales += recentValuesSales[recentValuesSales.length - 1 - j] * normalizedCoefSales[j];
        }

        const prevItem: any = predictions.length > 0 ? predictions[predictions.length - 1] : lastData;
        const priceChange = ((predictedPrice - prevItem.avgPrice) / prevItem.avgPrice) * 100;
        const salesChange = ((predictedSales - prevItem.totalAmount) / prevItem.totalAmount) * 100;

        predictions.push({
            year: currentYear,
            month: currentMonth,
            yearMonth: `${monthNames[currentMonth - 1]} ${currentYear}`,
            avgPrice: Math.max(0, predictedPrice),
            totalAmount: Math.max(0, predictedSales),
            priceChange: predictedPrice - prevItem.avgPrice,
            salesChange: predictedSales - prevItem.totalAmount,
            priceChangePercent: priceChange,
            salesChangePercent: salesChange,
            isPredicted: true
        });

        recentValuesPrice.shift();
        recentValuesPrice.push(predictedPrice);
        recentValuesSales.shift();
        recentValuesSales.push(predictedSales);
    }

    return predictions;
};

// Main prediction function
const generatePredictions = (
    historicalData: any[],
    targetYear: number,
    targetMonth: number,
    method: PredictionMethod
) => {
    if (historicalData.length < 3) {
        return [];
    }

    const lastData = historicalData[historicalData.length - 1];

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

const GeneralSalePriceStats = ({ chartData }: SalesChartProps) => {
    const allFormattedData = useMemo(() => {
        const sorted = chartData
            .map(item => ({
                ...item,
                yearMonth: `${monthNames[item.month - 1]} ${item.year}`
            }))
            .sort((a, b) => (a.year - b.year) || (a.month - b.month));

        if (sorted.length > 2) {
            sorted.shift();
            sorted.pop();
        }

        const withChanges = sorted.map((item, index) => {
            if (index === 0) {
                return {
                    ...item,
                    priceChange: 0,
                    salesChange: 0,
                    priceChangePercent: 0,
                    salesChangePercent: 0,
                    isPredicted: false
                };
            }

            const prev = sorted[index - 1];
            const priceChange = ((item.avgPrice - prev.avgPrice) / prev.avgPrice) * 100;
            const salesChange = ((item.totalAmount - prev.totalAmount) / prev.totalAmount) * 100;

            return {
                ...item,
                priceChange: item.avgPrice - prev.avgPrice,
                salesChange: item.totalAmount - prev.totalAmount,
                priceChangePercent: priceChange,
                salesChangePercent: salesChange,
                isPredicted: false
            };
        });

        return withChanges;
    }, [chartData]);

    const [rangeValues, setRangeValues] = useState<number[]>([0, Math.max(0, allFormattedData.length - 1)]);
    const [enablePrediction, setEnablePrediction] = useState(false);
    const [predictionMonths, setPredictionMonths] = useState<number>(6); // Number of months to predict
    const [predictionMethod, setPredictionMethod] = useState<PredictionMethod>("linear");

    // Generate predictions
    const dataWithPredictions = useMemo(() => {
        if (!enablePrediction || predictionMonths === 0 || allFormattedData.length === 0) {
            return allFormattedData;
        }

        const lastData = allFormattedData[allFormattedData.length - 1];

        // Calculate target date based on prediction months
        let targetYear = lastData.year;
        let targetMonth = lastData.month + predictionMonths;

        while (targetMonth > 12) {
            targetMonth -= 12;
            targetYear++;
        }

        const predictions = generatePredictions(allFormattedData, targetYear, targetMonth, predictionMethod);

        return [...allFormattedData, ...predictions];
    }, [allFormattedData, enablePrediction, predictionMonths, predictionMethod]);

    // Update range when predictions change
    useEffect(() => {
        if (dataWithPredictions.length > 0) {
            setRangeValues([0, dataWithPredictions.length - 1]);
        }
    }, [dataWithPredictions.length]);

    const displayedData = useMemo(() => {
        return dataWithPredictions.slice(rangeValues[0], rangeValues[1] + 1);
    }, [dataWithPredictions, rangeValues]);

    const getDateRange = () => {
        if (displayedData.length === 0) return "";
        const first = displayedData[0];
        const last = displayedData[displayedData.length - 1];
        return `${monthNames[first.month - 1]} ${first.year} - ${monthNames[last.month - 1]} ${last.year}`;
    };

    const handleSliderChange = (values: number[]) => {
        setRangeValues(values);
    };

    const correlationInsight = useMemo(() => {
        const realData = displayedData.filter(d => !d.isPredicted);
        if (realData.length < 2) return null;

        let inverseCases = 0;
        let directCases = 0;
        let totalCases = 0;

        realData.slice(1).forEach(item => {
            if (Math.abs(item.priceChangePercent) > 0.5) {
                totalCases++;
                if ((item.priceChangePercent < 0 && item.salesChangePercent > 0) ||
                    (item.priceChangePercent > 0 && item.salesChangePercent < 0)) {
                    inverseCases++;
                } else if ((item.priceChangePercent < 0 && item.salesChangePercent < 0) ||
                    (item.priceChangePercent > 0 && item.salesChangePercent > 0)) {
                    directCases++;
                }
            }
        });

        if (totalCases === 0) return null;

        const inversePercent = (inverseCases / totalCases * 100).toFixed(0);
        return `${inversePercent}% inverse correlation (price changes opposite to sales)`;
    }, [displayedData]);

    const handleExport = async () => {
        try {
            const response = await fetch('/api/export-price-stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    displayedData,
                    dateRange: getDateRange(),
                    correlationInsight: correlationInsight || 'No significant correlation detected',
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
                ? `price-vs-sales-with-predictions-${predictionMethod}-${new Date().toISOString().split('T')[0]}.xlsx`
                : `price-vs-sales-${new Date().toISOString().split('T')[0]}.xlsx`;
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
        <div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex-1">
                        <CardTitle>Price Changes vs Sales Evolution</CardTitle>
                        <CardDescription>{getDateRange()}</CardDescription>
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

                                <div className="flex flex-col space-y-2 flex-1 min-w-[250px] bg-blue-900 p-4 rounded-xl">
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

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{dataWithPredictions[rangeValues[0]]?.yearMonth || ''}</span>
                            <span>{dataWithPredictions[rangeValues[1]]?.yearMonth || ''}</span>
                        </div>
                        <Slider
                            min={0}
                            max={Math.max(0, dataWithPredictions.length - 1)}
                            step={1}
                            value={rangeValues}
                            onValueChange={handleSliderChange}
                            className="w-full"
                        />
                    </div>

                    <ChartContainer config={chartConfig}>
                        <ComposedChart data={displayedData} margin={{ left: 12, right: 12, top: 20 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis
                                dataKey="yearMonth"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                            />
                            <YAxis
                                tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
                                label={{ value: 'Change %', angle: -90, position: 'insideLeft' }}
                            />
                            <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />

                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-neutral-200 z-10 text-black border rounded-lg shadow-lg p-3">
                                            <p className="font-medium mb-2">
                                                {data.yearMonth}
                                                {data.isPredicted && <span className="ml-2 text-xs text-purple-600">(Predicted)</span>}
                                            </p>
                                            <p className="text-sm" style={{ color: '#ef4444' }}>
                                                Price: {data.priceChangePercent > 0 ? '+' : ''}{data.priceChangePercent.toFixed(1)}%
                                                <span className="text-muted-foreground ml-2">(${data.avgPrice.toFixed(2)})</span>
                                            </p>
                                            <p className="text-sm" style={{ color: '#3b82f6' }}>
                                                Sales: {data.salesChangePercent > 0 ? '+' : ''}{data.salesChangePercent.toFixed(1)}%
                                                <span className="text-muted-foreground ml-2">(${data.totalAmount.toLocaleString()})</span>
                                            </p>
                                        </div>
                                    );
                                }}
                            />
                            <Legend />

                            <Bar
                                name="Price Change %"
                                dataKey="priceChangePercent"
                                radius={[4, 4, 0, 0]}
                            >
                                {displayedData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill="#ef4444"
                                        fillOpacity={entry.isPredicted ? 0.35 : 0.7}
                                    />
                                ))}
                            </Bar>
                            <Line
                                name="Sales Change %"
                                dataKey="salesChangePercent"
                                type="monotone"
                                strokeWidth={3}
                                stroke="#3b82f6"
                                dot={(props: any) => {
                                    const { cx, cy, payload, index } = props;
                                    if (!payload) return <></>;

                                    const isPred = payload.isPredicted;
                                    return (
                                        <circle
                                            key={`dot-${index}`}
                                            cx={cx}
                                            cy={cy}
                                            r={isPred ? 6 : 4}
                                            fill={isPred ? '#a855f7' : '#3b82f6'}
                                            stroke={isPred ? '#7c3aed' : '#2563eb'}
                                            strokeWidth={2}
                                        />
                                    );
                                }}
                            />
                        </ComposedChart>
                    </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                    {correlationInsight && (
                        <div className="text-muted-foreground">
                            {correlationInsight}
                        </div>
                    )}
                    {predictionCount > 0 && (
                        <div className="text-muted-foreground text-xs">
                            Note: Predictions using {selectedMethodInfo?.label} method are estimates and should be used for planning purposes only.
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}

export default GeneralSalePriceStats