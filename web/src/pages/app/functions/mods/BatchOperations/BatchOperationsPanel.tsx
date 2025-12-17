import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Progress,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Checkbox,
  CheckboxGroup,
  Stack,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useToast,
  Tooltip,
  IconButton,
  Collapse,
  useColorModeValue,
} from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon, InfoIcon } from "@chakra-ui/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { TFunction } from "@/apis/typing";
import useFunctionStore from "../../store";

// 临时API调用 - 模拟实现
const batchDeploy = async (functionIds: string[], options?: any) => {
  // 模拟批量部署
  await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟延迟
  return { 
    data: { 
      totalFunctions: functionIds.length,
      successfulDeployments: functionIds.length,
      failedDeployments: 0,
      results: functionIds.map(id => ({
        functionId: id,
        functionName: `function-${id}`,
        success: true,
        duration: Math.random() * 1000 + 500
      })),
      totalDuration: 2000,
      missingDependencies: []
    } 
  };
};

const batchStop = async (functionIds: string[]) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { 
    data: { 
      totalFunctions: functionIds.length,
      successfulDeployments: functionIds.length,
      failedDeployments: 0,
      results: functionIds.map(id => ({
        functionId: id,
        functionName: `function-${id}`,
        success: true,
        duration: Math.random() * 500 + 200
      })),
      totalDuration: 1000,
      missingDependencies: []
    } 
  };
};

const batchRestart = async (functionIds: string[]) => {
  await new Promise(resolve => setTimeout(resolve, 3000));
  return { 
    data: { 
      totalFunctions: functionIds.length,
      successfulDeployments: functionIds.length,
      failedDeployments: 0,
      results: functionIds.map(id => ({
        functionId: id,
        functionName: `function-${id}`,
        success: true,
        duration: Math.random() * 1500 + 800
      })),
      totalDuration: 3000,
      missingDependencies: []
    } 
  };
};

const getBatchRecommendations = async (functionIds: string[]) => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { 
    data: {
      recommendedOrder: functionIds,
      dependencyGroups: [
        {
          dependencies: ['axios', 'lodash'],
          functions: functionIds.slice(0, 2)
        },
        {
          dependencies: [],
          functions: functionIds.slice(2)
        }
      ],
      estimatedDuration: functionIds.length * 5000,
      warnings: functionIds.length > 5 ? ['批量操作函数数量较多，建议分批执行'] : []
    }
  };
};

interface BatchOperationsPanelProps {
  functions: TFunction[];
  selectedFunctions: string[];
  onSelectionChange: (selected: string[]) => void;
}

interface BatchResult {
  totalFunctions: number;
  successfulDeployments: number;
  failedDeployments: number;
  results: Array<{
    functionId: string;
    functionName: string;
    success: boolean;
    error?: string;
    duration: number;
  }>;
  totalDuration: number;
  missingDependencies: string[];
}

export default function BatchOperationsPanel({
  functions,
  selectedFunctions,
  onSelectionChange,
}: BatchOperationsPanelProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [operation, setOperation] = useState<'deploy' | 'stop' | 'restart' | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchOptions, setBatchOptions] = useState({
    parallel: true,
    maxConcurrency: 5,
    skipDependencyCheck: false,
    autoInstallDependencies: true,
  });

  const toast = useToast();
  const queryClient = useQueryClient();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // 获取批量操作建议
  const { data: recommendations, isLoading: loadingRecommendations } = useQuery({
    queryKey: ['batchRecommendations', selectedFunctions],
    queryFn: () => getBatchRecommendations(selectedFunctions),
    enabled: selectedFunctions.length > 0,
  });

  // 批量部署
  const batchDeployMutation = useMutation({
    mutationFn: ({ functionIds, options }: { functionIds: string[]; options?: any }) =>
      batchDeploy(functionIds, options),
    onSuccess: (data) => {
      setBatchResult(data.data);
      toast({
        title: "批量部署完成",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      queryClient.invalidateQueries({ queryKey: ['functions'] });
    },
    onError: (error: any) => {
      toast({
        title: "批量部署失败",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    },
  });

  // 批量停止
  const batchStopMutation = useMutation({
    mutationFn: batchStop,
    onSuccess: (data) => {
      setBatchResult(data.data);
      toast({
        title: "批量停止完成",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      queryClient.invalidateQueries({ queryKey: ['functions'] });
    },
  });

  // 批量重启
  const batchRestartMutation = useMutation({
    mutationFn: batchRestart,
    onSuccess: (data) => {
      setBatchResult(data.data);
      toast({
        title: "批量重启完成",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      queryClient.invalidateQueries({ queryKey: ['functions'] });
    },
  });

  const handleBatchOperation = (op: 'deploy' | 'stop' | 'restart') => {
    if (selectedFunctions.length === 0) {
      toast({
        title: "请选择函数",
        description: "请至少选择一个函数进行批量操作",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setOperation(op);
    setBatchResult(null);
    onOpen();
  };

  const executeBatchOperation = () => {
    switch (operation) {
      case 'deploy':
        batchDeployMutation.mutate({
          functionIds: selectedFunctions,
          options: batchOptions,
        });
        break;
      case 'stop':
        batchStopMutation.mutate(selectedFunctions);
        break;
      case 'restart':
        batchRestartMutation.mutate(selectedFunctions);
        break;
    }
  };

  const isLoading = batchDeployMutation.isPending || 
                   batchStopMutation.isPending || 
                   batchRestartMutation.isPending;

  const selectedFunctionNames = functions
    .filter(f => selectedFunctions.includes(f._id))
    .map(f => f.name);

  return (
    <Box bg={bgColor} border="1px" borderColor={borderColor} borderRadius="md" p={4}>
      <VStack spacing={4} align="stretch">
        {/* 标题和统计 */}
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="bold">
            批量操作
          </Text>
          <Badge colorScheme="blue" variant="subtle">
            已选择 {selectedFunctions.length} 个函数
          </Badge>
        </HStack>

        {/* 函数选择 */}
        <Box>
          <Text fontSize="sm" fontWeight="medium" mb={2}>
            选择函数:
          </Text>
          <CheckboxGroup
            value={selectedFunctions}
            onChange={(values) => onSelectionChange(values as string[])}
          >
            <Stack spacing={2} maxH="200px" overflowY="auto">
              <Checkbox
                value="all"
                isChecked={selectedFunctions.length === functions.length}
                isIndeterminate={
                  selectedFunctions.length > 0 && selectedFunctions.length < functions.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    onSelectionChange(functions.map(f => f._id));
                  } else {
                    onSelectionChange([]);
                  }
                }}
              >
                全选
              </Checkbox>
              {functions.map((func) => (
                <Checkbox key={func._id} value={func._id}>
                  <HStack>
                    <Text>{func.name}</Text>
                    <Badge
                      size="sm"
                      colorScheme={func.state === 'RUNNING' ? 'green' : 'gray'}
                    >
                      {func.state || 'STOPPED'}
                    </Badge>
                  </HStack>
                </Checkbox>
              ))}
            </Stack>
          </Box>
        </Box>

        {/* 批量操作建议 */}
        {selectedFunctions.length > 0 && recommendations && (
          <Box>
            <HStack mb={2}>
              <Text fontSize="sm" fontWeight="medium">
                操作建议
              </Text>
              <Tooltip label="基于函数复杂度和依赖关系的智能建议">
                <InfoIcon boxSize={3} color="gray.500" />
              </Tooltip>
            </HStack>
            <Alert status="info" size="sm">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">
                  预计耗时: {Math.round(recommendations.data.estimatedDuration / 1000)}秒
                </AlertTitle>
                {recommendations.data.warnings.length > 0 && (
                  <AlertDescription fontSize="xs">
                    {recommendations.data.warnings.join(', ')}
                  </AlertDescription>
                )}
              </Box>
            </Alert>
          </Box>
        )}

        <Divider />

        {/* 操作按钮 */}
        <HStack spacing={3}>
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => handleBatchOperation('deploy')}
            isDisabled={selectedFunctions.length === 0}
          >
            批量部署
          </Button>
          <Button
            colorScheme="orange"
            size="sm"
            onClick={() => handleBatchOperation('restart')}
            isDisabled={selectedFunctions.length === 0}
          >
            批量重启
          </Button>
          <Button
            colorScheme="red"
            size="sm"
            onClick={() => handleBatchOperation('stop')}
            isDisabled={selectedFunctions.length === 0}
          >
            批量停止
          </Button>
        </HStack>

        {/* 高级选项 */}
        <Box>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={showAdvanced ? <ChevronUpIcon /> : <ChevronDownIcon />}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            高级选项
          </Button>
          <Collapse in={showAdvanced}>
            <VStack spacing={3} align="stretch" mt={3} p={3} bg="gray.50" borderRadius="md">
              <Checkbox
                isChecked={batchOptions.parallel}
                onChange={(e) => setBatchOptions(prev => ({ ...prev, parallel: e.target.checked }))}
              >
                并行执行
              </Checkbox>
              <Checkbox
                isChecked={batchOptions.autoInstallDependencies}
                onChange={(e) => setBatchOptions(prev => ({ ...prev, autoInstallDependencies: e.target.checked }))}
              >
                自动安装依赖
              </Checkbox>
              <Checkbox
                isChecked={batchOptions.skipDependencyCheck}
                onChange={(e) => setBatchOptions(prev => ({ ...prev, skipDependencyCheck: e.target.checked }))}
              >
                跳过依赖检查
              </Checkbox>
              <HStack>
                <Text fontSize="sm">最大并发数:</Text>
                <Button
                  size="xs"
                  onClick={() => setBatchOptions(prev => ({ ...prev, maxConcurrency: Math.max(1, prev.maxConcurrency - 1) }))}
                >
                  -
                </Button>
                <Text fontSize="sm" minW="20px" textAlign="center">
                  {batchOptions.maxConcurrency}
                </Text>
                <Button
                  size="xs"
                  onClick={() => setBatchOptions(prev => ({ ...prev, maxConcurrency: Math.min(10, prev.maxConcurrency + 1) }))}
                >
                  +
                </Button>
              </HStack>
            </VStack>
          </Collapse>
        </Box>
      </VStack>

      {/* 批量操作确认对话框 */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            确认批量{operation === 'deploy' ? '部署' : operation === 'stop' ? '停止' : '重启'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                将对以下 {selectedFunctions.length} 个函数执行
                {operation === 'deploy' ? '部署' : operation === 'stop' ? '停止' : '重启'}操作:
              </Text>
              
              <Box maxH="150px" overflowY="auto" p={2} bg="gray.50" borderRadius="md">
                {selectedFunctionNames.map((name, index) => (
                  <Text key={index} fontSize="sm">
                    • {name}
                  </Text>
                ))}
              </Box>

              {operation === 'deploy' && recommendations && (
                <Alert status="info">
                  <AlertIcon />
                  <Box>
                    <AlertTitle fontSize="sm">预计耗时:</AlertTitle>
                    <AlertDescription fontSize="sm">
                      约 {Math.round(recommendations.data.estimatedDuration / 1000)} 秒
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* 显示批量操作结果 */}
              {batchResult && (
                <Box>
                  <Text fontWeight="bold" mb={2}>操作结果:</Text>
                  <VStack spacing={2} align="stretch">
                    <HStack>
                      <Stat size="sm">
                        <StatLabel>成功</StatLabel>
                        <StatNumber color="green.500">
                          {batchResult.successfulDeployments}
                        </StatNumber>
                      </Stat>
                      <Stat size="sm">
                        <StatLabel>失败</StatLabel>
                        <StatNumber color="red.500">
                          {batchResult.failedDeployments}
                        </StatNumber>
                      </Stat>
                      <Stat size="sm">
                        <StatLabel>总耗时</StatLabel>
                        <StatNumber>
                          {Math.round(batchResult.totalDuration / 1000)}s
                        </StatNumber>
                      </Stat>
                    </HStack>

                    {batchResult.results.some(r => !r.success) && (
                      <Box>
                        <Text fontSize="sm" fontWeight="medium" color="red.500">
                          失败的函数:
                        </Text>
                        {batchResult.results
                          .filter(r => !r.success)
                          .map((result, index) => (
                            <Text key={index} fontSize="xs" color="red.500">
                              • {result.functionName}: {result.error}
                            </Text>
                          ))}
                      </Box>
                    )}
                  </VStack>
                </Box>
              )}

              {isLoading && (
                <Box>
                  <Text mb={2}>正在执行批量操作...</Text>
                  <Progress isIndeterminate colorScheme="blue" />
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              取消
            </Button>
            <Button
              colorScheme="blue"
              onClick={executeBatchOperation}
              isLoading={isLoading}
              isDisabled={batchResult !== null}
            >
              确认执行
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}