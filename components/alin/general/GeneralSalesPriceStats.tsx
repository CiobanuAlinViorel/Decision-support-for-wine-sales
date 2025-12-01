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

// Intelligent prediction with seasonality
const generateSmartPredictions = (
    historicalData: any[],
    targetYear: number,
    targetMonth: number
) => {
    if (historicalData.length < 6) {
        // Not enough data for smart predictions
        return [];
    }

    const lastData = historicalData[historicalData.length - 1];

    // Calculate monthly averages for seasonality
    const monthlyStats: { [key: number]: { prices: number[], sales: number[] } } = {};
    for (let m = 1; m <= 12; m++) {
        monthlyStats[m] = { prices: [], sales: [] };
    }

    historicalData.forEach(item => {
        monthlyStats[item.month].prices.push(item.avgPrice);
        monthlyStats[item.month].sales.push(item.totalAmount);
    });

    // Calculate average for each month
    const monthlyAvg: { [key: number]: { avgPrice: number, avgSales: number } } = {};
    for (let m = 1; m <= 12; m++) {
        const prices = monthlyStats[m].prices;
        const sales = monthlyStats[m].sales;
        monthlyAvg[m] = {
            avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
            avgSales: sales.length > 0 ? sales.reduce((a, b) => a + b, 0) / sales.length : 0
        };
    }

    // Calculate overall trend (linear regression on indices)
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

    // Calculate growth rate (percentage change per month)
    const avgPrice = sumY_price / n;
    const avgSales = sumY_sales / n;
    const monthlyGrowth_price = (trendSlope_price / avgPrice) * 100;
    const monthlyGrowth_sales = (trendSlope_sales / avgSales) * 100;

    console.log('Smart prediction:', {
        monthlyGrowth_price: monthlyGrowth_price.toFixed(2) + '%',
        monthlyGrowth_sales: monthlyGrowth_sales.toFixed(2) + '%',
        hasSeasonality: Object.values(monthlyAvg).some(m => m.avgPrice > 0)
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

        // Get seasonal baseline for this month
        const seasonalPrice = monthlyAvg[currentMonth].avgPrice || avgPrice;
        const seasonalSales = monthlyAvg[currentMonth].avgSales || avgSales;

        // Apply trend: seasonal baseline * (1 + growth_rate)^months_ahead
        const trendMultiplier = Math.pow(1 + (monthlyGrowth_price / 100), monthsAhead);
        const trendMultiplier_sales = Math.pow(1 + (monthlyGrowth_sales / 100), monthsAhead);

        // Combine seasonal pattern with trend
        const predictedPrice = seasonalPrice * trendMultiplier;
        const predictedSales = seasonalSales * trendMultiplier_sales;

        const prevItem: any = predictions.length > 0
            ? predictions[predictions.length - 1]
            : lastData;

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

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const GeneralSalePriceStats = ({ chartData }: SalesChartProps) => {
    const allFormattedData = useMemo(() => {
        console.log('Processing chartData:', chartData.length, 'items');
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

        console.log('After processing:', sorted.length, 'items. Last item:', sorted[sorted.length - 1]);

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
    const [predictionYear, setPredictionYear] = useState<string>("");
    const [predictionMonth, setPredictionMonth] = useState<string>("");

    // Debug: log state changes
    useEffect(() => {
        console.log('Prediction state changed:', { enablePrediction, predictionYear, predictionMonth });
    }, [enablePrediction, predictionYear, predictionMonth]);

    // Get available years from data
    const availableYears = useMemo(() => {
        const years = new Set(allFormattedData.map(d => d.year));
        const maxYear = Math.max(...years);
        const lastData = allFormattedData[allFormattedData.length - 1];

        // Allow prediction up to 2 years in the future
        const futureYears = [maxYear + 1, maxYear + 2];
        return [...Array.from(years), ...futureYears].sort();
    }, [allFormattedData]);

    // Generate predictions
    const dataWithPredictions = useMemo(() => {
        if (!enablePrediction || !predictionYear || !predictionMonth) {
            return allFormattedData;
        }

        const targetYear = parseInt(predictionYear);
        const targetMonth = parseInt(predictionMonth);
        const lastData = allFormattedData[allFormattedData.length - 1];

        console.log('Prediction params:', { targetYear, targetMonth, lastYear: lastData.year, lastMonth: lastData.month });

        // Check if target is in the future
        if (targetYear < lastData.year || (targetYear === lastData.year && targetMonth <= lastData.month)) {
            console.log('Target is not in future, returning original data');
            return allFormattedData;
        }

        const predictions = generateSmartPredictions(allFormattedData, targetYear, targetMonth);
        console.log('Generated predictions:', predictions.length);

        return [...allFormattedData, ...predictions];
    }, [allFormattedData, enablePrediction, predictionYear, predictionMonth]);

    // Update range when predictions change
    useEffect(() => {
        console.log('Data length changed:', dataWithPredictions.length, 'original:', allFormattedData.length);
        if (dataWithPredictions.length > 0) {
            setRangeValues([0, dataWithPredictions.length - 1]);
        }
    }, [dataWithPredictions.length, allFormattedData.length]);

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
                ? `price-vs-sales-with-predictions-${new Date().toISOString().split('T')[0]}.xlsx`
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
                                    const { cx, cy, payload } = props;
                                    if (!payload) return <></>;

                                    const isPred = payload.isPredicted;
                                    return (
                                        <circle
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
                            Note: Predictions are based on linear regression and should be used as estimates only.
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}

export default GeneralSalePriceStats