import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  Button,
  useColorModeValue,
  Grid,
  GridItem,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Tooltip,
  IconButton,
  useToast,
} from "@chakra-ui/react";
import { RefreshIcon, DownloadIcon, InfoIcon } from "@chakra-ui/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

import { TFunction } from "@/apis/typing";

// 注册Chart.js组件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

// 临时API调用 - 模拟实现，实际需要调用后端API
const getPerformanceOverview = async () => {
  await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
  return {
    data: {
      totalFunctions: Math.floor(Math.random() * 50) + 10,
      totalExecutions: Math.floor(Math.random() * 2000) + 500,
      averageSuccessRate: 95 + Math.random() * 4,
      averageExecutionTime: 200 + Math.random() * 100,
      topPerformingFunctions: [
        { functionName: "user-auth", successRate: 99.2, averageExecutionTime: 120 },
        { functionName: "data-processor", successRate: 98.8, averageExecutionTime: 180 },
        { functionName: "api-gateway", successRate: 97.5, averageExecutionTime: 95 },
      ],
      poorPerformingFunctions: [
        { functionName: "heavy-compute", successRate: 85.2, averageExecutionTime: 2500 },
        { functionName: "file-processor", successRate: 88.1, averageExecutionTime: 1800 },
      ]
    }
  };
};

const getFunctionPerformanceStats = async (functionId: string) => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const totalExecutions = Math.floor(Math.random() * 500) + 50;
  const successfulExecutions = Math.floor(totalExecutions * (0.9 + Math.random() * 0.1));
  
  return {
    data: {
      functionId,
      functionName: `function-${functionId.slice(-8)}`,
      totalExecutions,
      successfulExecutions,
      failedExecutions: totalExecutions - successfulExecutions,
      averageExecutionTime: Math.floor(200 + Math.random() * 300),
      maxExecutionTime: Math.floor(800 + Math.random() * 1000),
      minExecutionTime: Math.floor(50 + Math.random() * 100),
      averageMemoryUsage: Math.floor(50 + Math.random() * 50),
      lastExecution: new Date(Date.now() - Math.random() * 3600000), // 最近1小时内
      successRate: Math.round((successfulExecutions / totalExecutions) * 100 * 10) / 10
    }
  };
};

const getFunctionPerformanceTrend = async (functionId: string, hours: number = 24) => {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // 生成模拟趋势数据
  const now = new Date();
  const data = [];
  const baseExecutionTime = 200 + Math.random() * 100;
  const baseMemoryUsage = 60 + Math.random() * 20;
  
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    // 添加一些趋势和随机波动
    const trend = Math.sin(i / hours * Math.PI * 2) * 20;
    const noise = (Math.random() - 0.5) * 40;
    
    data.push({
      timestamp: time,
      executionTime: Math.max(50, baseExecutionTime + trend + noise),
      memoryUsage: Math.max(20, baseMemoryUsage + trend * 0.5 + noise * 0.3),
      success: Math.random() > 0.05 // 95% 成功率
    });
  }
  return { data };
};

const getCacheStats = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    data: {
      functionCache: {
        size: Math.floor(Math.random() * 100) + 20,
        hitRate: 70 + Math.random() * 25,
        totalAccess: Math.floor(Math.random() * 2000) + 500
      },
      dependencyCache: {
        size: Math.floor(Math.random() * 30) + 5,
        hitRate: 85 + Math.random() * 10,
        totalAccess: Math.floor(Math.random() * 500) + 100
      }
    }
  };
};

interface PerformanceMonitorPanelProps {
  functions: TFunction[];
  selectedFunction?: TFunction;
}

export default function PerformanceMonitorPanel({
  functions,
  selectedFunction,
}: PerformanceMonitorPanelProps) {
  const [timeRange, setTimeRange] = useState(24);
  const [selectedFunctionId, setSelectedFunctionId] = useState(selectedFunction?._id || '');
  
  const toast = useToast();
  const queryClient = useQueryClient();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // 获取性能概览
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['performanceOverview'],
    queryFn: getPerformanceOverview,
    refetchInterval: 30000, // 30秒刷新一次
  });

  // 获取函数性能统计
  const { data: functionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['functionPerformanceStats', selectedFunctionId],
    queryFn: () => getFunctionPerformanceStats(selectedFunctionId),
    enabled: !!selectedFunctionId,
  });

  // 获取性能趋势
  const { data: performanceTrend, isLoading: trendLoading } = useQuery({
    queryKey: ['performanceTrend', selectedFunctionId, timeRange],
    queryFn: () => getFunctionPerformanceTrend(selectedFunctionId, timeRange),
    enabled: !!selectedFunctionId,
  });

  // 获取缓存统计
  const { data: cacheStats, isLoading: cacheLoading } = useQuery({
    queryKey: ['cacheStats'],
    queryFn: getCacheStats,
    refetchInterval: 60000, // 1分钟刷新一次
  });

  // 准备图表数据
  const chartData = performanceTrend?.data ? {
    labels: performanceTrend.data.map((item: any) => 
      new Date(item.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: '执行时间 (ms)',
        data: performanceTrend.data.map((item: any) => item.executionTime),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        yAxisID: 'y',
      },
      {
        label: '内存使用 (MB)',
        data: performanceTrend.data.map((item: any) => item.memoryUsage),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        yAxisID: 'y1',
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '时间'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: '执行时间 (ms)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: '内存使用 (MB)'
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['performanceOverview'] });
    queryClient.invalidateQueries({ queryKey: ['cacheStats'] });
    if (selectedFunctionId) {
      queryClient.invalidateQueries({ queryKey: ['functionPerformanceStats', selectedFunctionId] });
      queryClient.invalidateQueries({ queryKey: ['performanceTrend', selectedFunctionId] });
    }
    toast({
      title: "数据已刷新",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
      <VStack spacing={6} align="stretch">
        {/* 标题和控制 */}
        <HStack justify="space-between">
          <Heading size="md">性能监控</Heading>
          <HStack>
            <Tooltip label="刷新数据">
              <IconButton
                aria-label="刷新"
                icon={<RefreshIcon />}
                size="sm"
                onClick={handleRefresh}
              />
            </Tooltip>
            <Tooltip label="导出报告">
              <IconButton
                aria-label="导出"
                icon={<DownloadIcon />}
                size="sm"
                onClick={() => {
                  toast({
                    title: "导出功能开发中",
                    status: "info",
                    duration: 2000,
                  });
                }}
              />
            </Tooltip>
          </HStack>
        </HStack>

        <Tabs>
          <TabList>
            <Tab>系统概览</Tab>
            <Tab>函数详情</Tab>
            <Tab>缓存统计</Tab>
          </TabList>

          <TabPanels>
            {/* 系统概览 */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {overview && (
                  <>
                    {/* 总体统计 */}
                    <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                      <GridItem>
                        <Stat>
                          <StatLabel>总函数数</StatLabel>
                          <StatNumber>{overview.data.totalFunctions}</StatNumber>
                        </Stat>
                      </GridItem>
                      <GridItem>
                        <Stat>
                          <StatLabel>总执行次数</StatLabel>
                          <StatNumber>{overview.data.totalExecutions.toLocaleString()}</StatNumber>
                        </Stat>
                      </GridItem>
                      <GridItem>
                        <Stat>
                          <StatLabel>平均成功率</StatLabel>
                          <StatNumber>{overview.data.averageSuccessRate}%</StatNumber>
                          <StatHelpText>
                            <StatArrow type="increase" />
                            良好
                          </StatHelpText>
                        </Stat>
                      </GridItem>
                      <GridItem>
                        <Stat>
                          <StatLabel>平均执行时间</StatLabel>
                          <StatNumber>{overview.data.averageExecutionTime}ms</StatNumber>
                        </Stat>
                      </GridItem>
                    </Grid>

                    {/* 性能排行 */}
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      <GridItem>
                        <Card>
                          <CardHeader>
                            <Heading size="sm">性能最佳函数</Heading>
                          </CardHeader>
                          <CardBody>
                            <VStack spacing={2} align="stretch">
                              {overview.data.topPerformingFunctions.map((func: any, index: number) => (
                                <HStack key={index} justify="space-between">
                                  <Text fontSize="sm">{func.functionName}</Text>
                                  <HStack>
                                    <Badge colorScheme="green" size="sm">
                                      {func.successRate}%
                                    </Badge>
                                    <Text fontSize="xs" color="gray.500">
                                      {func.averageExecutionTime}ms
                                    </Text>
                                  </HStack>
                                </HStack>
                              ))}
                            </VStack>
                          </CardBody>
                        </Card>
                      </GridItem>
                      <GridItem>
                        <Card>
                          <CardHeader>
                            <Heading size="sm">需要优化的函数</Heading>
                          </CardHeader>
                          <CardBody>
                            <VStack spacing={2} align="stretch">
                              {overview.data.poorPerformingFunctions.map((func: any, index: number) => (
                                <HStack key={index} justify="space-between">
                                  <Text fontSize="sm">{func.functionName}</Text>
                                  <HStack>
                                    <Badge colorScheme="red" size="sm">
                                      {func.successRate}%
                                    </Badge>
                                    <Text fontSize="xs" color="gray.500">
                                      {func.averageExecutionTime}ms
                                    </Text>
                                  </HStack>
                                </HStack>
                              ))}
                            </VStack>
                          </CardBody>
                        </Card>
                      </GridItem>
                    </Grid>
                  </>
                )}
              </VStack>
            </TabPanel>

            {/* 函数详情 */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {/* 函数选择 */}
                <HStack>
                  <Text>选择函数:</Text>
                  <Select
                    value={selectedFunctionId}
                    onChange={(e) => setSelectedFunctionId(e.target.value)}
                    placeholder="请选择函数"
                    maxW="300px"
                  >
                    {functions.map((func) => (
                      <option key={func._id} value={func._id}>
                        {func.name}
                      </option>
                    ))}
                  </Select>
                  <Text>时间范围:</Text>
                  <Select
                    value={timeRange}
                    onChange={(e) => setTimeRange(Number(e.target.value))}
                    maxW="150px"
                  >
                    <option value={1}>1小时</option>
                    <option value={6}>6小时</option>
                    <option value={24}>24小时</option>
                    <option value={168}>7天</option>
                  </Select>
                </HStack>

                {selectedFunctionId && functionStats && (
                  <>
                    {/* 函数统计 */}
                    <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                      <GridItem>
                        <Stat>
                          <StatLabel>总执行次数</StatLabel>
                          <StatNumber>{functionStats.data.totalExecutions}</StatNumber>
                        </Stat>
                      </GridItem>
                      <GridItem>
                        <Stat>
                          <StatLabel>成功率</StatLabel>
                          <StatNumber color={functionStats.data.successRate > 95 ? "green.500" : "orange.500"}>
                            {functionStats.data.successRate}%
                          </StatNumber>
                        </Stat>
                      </GridItem>
                      <GridItem>
                        <Stat>
                          <StatLabel>平均执行时间</StatLabel>
                          <StatNumber>{functionStats.data.averageExecutionTime}ms</StatNumber>
                          <StatHelpText>
                            最大: {functionStats.data.maxExecutionTime}ms
                          </StatHelpText>
                        </Stat>
                      </GridItem>
                      <GridItem>
                        <Stat>
                          <StatLabel>平均内存使用</StatLabel>
                          <StatNumber>{functionStats.data.averageMemoryUsage}MB</StatNumber>
                        </Stat>
                      </GridItem>
                    </Grid>

                    {/* 性能趋势图 */}
                    {chartData && (
                      <Box>
                        <Text fontWeight="bold" mb={2}>性能趋势</Text>
                        <Box h="300px">
                          <Line data={chartData} options={chartOptions} />
                        </Box>
                      </Box>
                    )}
                  </>
                )}

                {!selectedFunctionId && (
                  <Alert status="info">
                    <AlertIcon />
                    <AlertTitle>请选择函数</AlertTitle>
                    <AlertDescription>
                      选择一个函数来查看详细的性能统计和趋势图
                    </AlertDescription>
                  </Alert>
                )}
              </VStack>
            </TabPanel>

            {/* 缓存统计 */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                {cacheStats && (
                  <>
                    <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                      <GridItem>
                        <Card>
                          <CardHeader>
                            <Heading size="sm">函数缓存</Heading>
                          </CardHeader>
                          <CardBody>
                            <VStack spacing={3} align="stretch">
                              <Stat>
                                <StatLabel>缓存大小</StatLabel>
                                <StatNumber>{cacheStats.data.functionCache.size}</StatNumber>
                                <StatHelpText>个函数</StatHelpText>
                              </Stat>
                              <Stat>
                                <StatLabel>命中率</StatLabel>
                                <StatNumber color="green.500">
                                  {cacheStats.data.functionCache.hitRate}%
                                </StatNumber>
                              </Stat>
                              <Stat>
                                <StatLabel>总访问次数</StatLabel>
                                <StatNumber>{cacheStats.data.functionCache.totalAccess}</StatNumber>
                              </Stat>
                            </VStack>
                          </CardBody>
                        </Card>
                      </GridItem>
                      <GridItem>
                        <Card>
                          <CardHeader>
                            <Heading size="sm">依赖缓存</Heading>
                          </CardHeader>
                          <CardBody>
                            <VStack spacing={3} align="stretch">
                              <Stat>
                                <StatLabel>缓存大小</StatLabel>
                                <StatNumber>{cacheStats.data.dependencyCache.size}</StatNumber>
                                <StatHelpText>个依赖</StatHelpText>
                              </Stat>
                              <Stat>
                                <StatLabel>命中率</StatLabel>
                                <StatNumber color="green.500">
                                  {cacheStats.data.dependencyCache.hitRate}%
                                </StatNumber>
                              </Stat>
                              <Stat>
                                <StatLabel>总访问次数</StatLabel>
                                <StatNumber>{cacheStats.data.dependencyCache.totalAccess}</StatNumber>
                              </Stat>
                            </VStack>
                          </CardBody>
                        </Card>
                      </GridItem>
                    </Grid>

                    {/* 缓存操作 */}
                    <HStack spacing={3}>
                      <Button
                        size="sm"
                        onClick={() => {
                          // 实际实现需要调用清理缓存API
                          toast({
                            title: "缓存已清理",
                            status: "success",
                            duration: 2000,
                          });
                        }}
                      >
                        清理缓存
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          // 实际实现需要调用预热缓存API
                          toast({
                            title: "缓存预热中...",
                            status: "info",
                            duration: 2000,
                          });
                        }}
                      >
                        预热缓存
                      </Button>
                    </HStack>
                  </>
                )}
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
}