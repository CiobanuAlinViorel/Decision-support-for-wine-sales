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

// Intelligent prediction with seasonality
const generateSmartSalesPredictions = (
    historicalData: any[],
    targetYear: number,
    targetMonth: number
) => {
    if (historicalData.length < 6) {
        return [];
    }

    const lastData = historicalData[historicalData.length - 1];

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
        monthlyAvg[m] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
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

    console.log('Smart sales prediction:', {
        monthlyGrowth: monthlyGrowth.toFixed(2) + '%',
        avgSales: avgSales.toFixed(0),
        hasSeasonality: Object.values(monthlyAvg).some(v => v > 0)
    });

    // Generate predictions
    const predictions = [];
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

const SalesByCategoryChart = ({ salesData }: SalesByCategoryChartProps) => {
    const categories = useMemo(() => Array.from(new Set(salesData.map(d => d.category))), [salesData]);
    const [selectedCategory, setSelectedCategory] = useState<string | "Total">("Total");
    const [enablePrediction, setEnablePrediction] = useState(false);
    const [predictionYear, setPredictionYear] = useState<string>("");
    const [predictionMonth, setPredictionMonth] = useState<string>("");

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

    // Get available years from data
    const availableYears = useMemo(() => {
        const years = new Set(aggregatedData.map(d => d.year));
        const maxYear = Math.max(...years);

        // Allow prediction up to 2 years in the future
        const futureYears = [maxYear + 1, maxYear + 2];
        return [...Array.from(years), ...futureYears].sort();
    }, [aggregatedData]);

    // Generate predictions
    const dataWithPredictions = useMemo(() => {
        if (!enablePrediction || !predictionYear || !predictionMonth || aggregatedData.length === 0) {
            return aggregatedData;
        }

        const targetYear = parseInt(predictionYear);
        const targetMonth = parseInt(predictionMonth);
        const lastData = aggregatedData[aggregatedData.length - 1];

        // Check if target is in the future
        if (targetYear < lastData.year || (targetYear === lastData.year && targetMonth <= lastData.month)) {
            return aggregatedData;
        }

        const predictions = generateSmartSalesPredictions(aggregatedData, targetYear, targetMonth);

        // Add category if needed
        const predictionsWithCategory = predictions.map(p => ({
            ...p,
            ...(selectedCategory !== "Total" && { category: selectedCategory })
        }));

        return [...aggregatedData, ...predictionsWithCategory];
    }, [aggregatedData, enablePrediction, predictionYear, predictionMonth, selectedCategory]);

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
                    hasPredictions: enablePrediction && predictionYear && predictionMonth
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
                ? `sales-trends-${selectedCategory.replace(/\s+/g, '-')}-with-predictions-${new Date().toISOString().split('T')[0]}.xlsx`
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
                            onChange={(e) => {
                                console.log('Checkbox changed:', e.target.checked);
                                setEnablePrediction(e.target.checked);
                            }}
                            className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="enablePrediction" className="text-sm font-medium cursor-pointer">
                            Enable Prediction
                        </label>
                    </div>

                    {enablePrediction && (
                        <>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-medium">Predict Until Year</label>
                                <Select value={predictionYear} onValueChange={(val) => {
                                    console.log('Year selected:', val);
                                    setPredictionYear(val);
                                }}>
                                    <SelectTrigger className="w-32 bg-white dark:bg-slate-900">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900 z-50">
                                        {availableYears.map(year => (
                                            <SelectItem key={year} value={year.toString()}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-medium">Predict Until Month</label>
                                <Select value={predictionMonth} onValueChange={(val) => {
                                    console.log('Month selected:', val);
                                    setPredictionMonth(val);
                                }}>
                                    <SelectTrigger className="w-32 bg-white dark:bg-slate-900">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900 z-50">
                                        {monthNames.map((month, idx) => (
                                            <SelectItem key={idx} value={(idx + 1).toString()}>
                                                {month}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                const { cx, cy, payload } = props;
                                if (!payload) return <></>;
                                const isPred = payload.isPredicted;
                                return (
                                    <circle
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
                        Note: Predictions are based on linear regression and should be used as estimates only.
                    </div>
                )}
            </CardFooter>
        </Card>
    );
};

export default SalesByCategoryChart;