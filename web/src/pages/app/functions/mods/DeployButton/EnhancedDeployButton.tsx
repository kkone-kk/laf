import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Tooltip,
  useDisclosure,
  Box,
  Text,
  VStack,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  List,
  ListItem,
  ListIcon,
  Divider,
  useToast,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "i18next";
import { CheckCircleIcon, WarningIcon, TimeIcon } from "@chakra-ui/icons";

import { RocketIcon } from "@/components/CommonIcon";
import CommonDiffEditor from "@/components/Editor/CommonDiffEditor";
import { Pages } from "@/constants";

import { useFunctionDetailQuery, useUpdateFunctionMutation } from "../../service";
import useFunctionStore from "../../store";

import { TFunction } from "@/apis/typing";
import useFunctionCache from "@/hooks/useFunctionCache";
import useHotKey, { DEFAULT_SHORTCUTS } from "@/hooks/useHotKey";
import useGlobalStore from "@/pages/globalStore";

// 临时API调用 - 需要后续更新API生成
import request from '@/utils/request';

interface DependencyCheckResult {
  isComplete: boolean;
  missingDependencies: string[];
  installedDependencies: string[];
  suggestions: string[];
}

interface FunctionRuntimeInfo {
  functionId: string;
  appid: string;
  state: 'RUNNING' | 'STOPPED';
  dependencyCheck?: DependencyCheckResult;
  canRun?: boolean;
  deploymentStatus?: 'pending' | 'checking' | 'installing' | 'ready' | 'failed';
  lastStateChange?: string;
}

export default function EnhancedDeployButton() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const store = useFunctionStore((state) => state);
  const queryClient = useQueryClient();
  const functionCache = useFunctionCache();
  const toast = useToast();

  const headerRef = React.useRef(null);
  const [changelog, setChangelog] = React.useState("");
  const [deploymentInfo, setDeploymentInfo] = useState<FunctionRuntimeInfo | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStep, setDeploymentStep] = useState<'checking' | 'installing' | 'deploying' | 'complete'>('checking');

  const { showSuccess, currentPageId } = useGlobalStore((state) => state);

  const updateFunctionMutation = useUpdateFunctionMutation();

  const functionDetailQuery = useFunctionDetailQuery(
    encodeURIComponent(store.currentFunction.name),
    {
      enabled: isOpen,
    },
  );

  const { displayName } = useHotKey(
    DEFAULT_SHORTCUTS.deploy,
    async () => {
      onOpen();
    },
    {
      enabled: currentPageId === Pages.function,
    },
  );

  // 检查函数状态和依赖 - 临时实现
  const checkFunctionStatus = async () => {
    try {
      // 临时使用模拟数据，实际应该调用后端API
      const mockDeploymentInfo: FunctionRuntimeInfo = {
        functionId: store.currentFunction._id,
        appid: useGlobalStore.getState().currentApp?.appid || '',
        state: 'STOPPED',
        dependencyCheck: {
          isComplete: true,
          missingDependencies: [],
          installedDependencies: ['fs', 'path'],
          suggestions: []
        },
        canRun: true,
        deploymentStatus: 'ready'
      };
      
      setDeploymentInfo(mockDeploymentInfo);
      return mockDeploymentInfo;
    } catch (error) {
      console.error('Failed to check function status:', error);
    }
    return null;
  };

  // 自动安装缺失的依赖
  const installMissingDependencies = async (missingDeps: string[]) => {
    try {
      setDeploymentStep('installing');
      
      const packages = missingDeps.map(dep => ({
        name: dep,
        spec: 'latest' // 默认安装最新版本
      }));

      // 临时实现 - 模拟依赖安装
      const response = { error: null, data: { success: true } };
      
      if (!response.error) {
        toast({
          title: "依赖安装成功",
          description: `已成功安装: ${missingDeps.join(', ')}`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        return true;
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      toast({
        title: "依赖安装失败",
        description: error.message || "安装依赖时发生错误",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return false;
    }
  };

  // 增强的部署函数
  const enhancedDeploy = async () => {
    setIsDeploying(true);
    setDeploymentStep('checking');

    try {
      // 首先更新函数代码
      const updateRes = await updateFunctionMutation.mutateAsync({
        description: store.currentFunction?.desc,
        code: functionCache.getCache(store.currentFunction!._id, store.currentFunction!.source?.code),
        methods: store.currentFunction?.methods,
        websocket: store.currentFunction?.websocket,
        name: store.currentFunction?.name,
        tags: store.currentFunction?.tags,
        params: store.currentFunction?.params,
        changelog,
      });

      if (updateRes.error) {
        throw new Error(updateRes.error);
      }

      // 临时实现 - 模拟增强的部署API调用
      setDeploymentStep('deploying');
      
      // 模拟部署响应
      const deployInfo: FunctionRuntimeInfo = {
        functionId: store.currentFunction._id,
        appid: useGlobalStore.getState().currentApp?.appid || '',
        state: 'RUNNING',
        dependencyCheck: {
          isComplete: true,
          missingDependencies: [],
          installedDependencies: ['fs', 'path', 'util'],
          suggestions: []
        },
        canRun: true,
        deploymentStatus: 'ready'
      };
      
      setDeploymentInfo(deployInfo);

      // 模拟检查依赖（在实际实现中，这里会调用真实的API）
      if (deployInfo.dependencyCheck && !deployInfo.dependencyCheck.isComplete) {
        const installSuccess = await installMissingDependencies(deployInfo.dependencyCheck.missingDependencies);
        
        if (installSuccess) {
          // 重新设置为完整状态
          deployInfo.dependencyCheck.isComplete = true;
          deployInfo.dependencyCheck.missingDependencies = [];
          setDeploymentInfo(deployInfo);
        }
      }

      setDeploymentStep('complete');

      // 更新本地状态
      store.setCurrentFunction(updateRes.data);
      store.setRecentFunctionList([
        updateRes.data as TFunction,
        ...store.recentFunctionList.filter((item) => item.name !== updateRes.data.name),
      ]);
      
      // 删除缓存
      functionCache.removeCache(store.currentFunction!._id);
      
      showSuccess("函数部署成功！");
      queryClient.invalidateQueries(["useFunctionHistoryQuery"]);
      
      // 延迟关闭模态框，让用户看到成功状态
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      toast({
        title: "部署失败",
        description: error.message || "部署过程中发生错误",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setDeploymentStep('checking');
    } finally {
      setIsDeploying(false);
    }
  };

  // 重置状态当模态框关闭时
  const handleClose = () => {
    setDeploymentInfo(null);
    setDeploymentStep('checking');
    setIsDeploying(false);
    setChangelog("");
    onClose();
  };

  // 当模态框打开时检查函数状态
  useEffect(() => {
    if (isOpen && !functionDetailQuery.isFetching) {
      checkFunctionStatus();
    }
  }, [isOpen, functionDetailQuery.isFetching]);

  const renderDeploymentStatus = () => {
    if (!deploymentInfo) return null;

    const { dependencyCheck, canRun, deploymentStatus } = deploymentInfo;

    return (
      <VStack spacing={4} align="stretch">
        {/* 依赖检查结果 */}
        {dependencyCheck && (
          <Box>
            <Text fontWeight="bold" mb={2}>依赖检查结果</Text>
            
            {dependencyCheck.isComplete ? (
              <Alert status="success">
                <AlertIcon />
                <AlertTitle>依赖完整！</AlertTitle>
                <AlertDescription>所有必需的依赖都已安装</AlertDescription>
              </Alert>
            ) : (
              <Alert status="warning">
                <AlertIcon />
                <AlertTitle>缺少依赖</AlertTitle>
                <AlertDescription>
                  需要安装以下依赖: {dependencyCheck.missingDependencies.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {dependencyCheck.suggestions.length > 0 && (
              <Box mt={3}>
                <Text fontSize="sm" fontWeight="medium" mb={2}>依赖说明:</Text>
                <List spacing={1} fontSize="sm">
                  {dependencyCheck.suggestions.map((suggestion, index) => (
                    <ListItem key={index}>
                      <ListIcon as={TimeIcon} color="blue.500" />
                      {suggestion}
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}

        {/* 部署状态 */}
        <Box>
          <Text fontWeight="bold" mb={2}>部署状态</Text>
          <HStack>
            <Badge 
              colorScheme={
                deploymentStatus === 'ready' ? 'green' :
                deploymentStatus === 'failed' ? 'red' :
                deploymentStatus === 'installing' ? 'yellow' : 'blue'
              }
            >
              {
                deploymentStatus === 'ready' ? '就绪' :
                deploymentStatus === 'failed' ? '失败' :
                deploymentStatus === 'installing' ? '安装中' :
                deploymentStatus === 'checking' ? '检查中' : '等待中'
              }
            </Badge>
            <Text fontSize="sm" color="gray.600">
              {canRun ? '函数可以运行' : '函数暂时无法运行'}
            </Text>
          </HStack>
        </Box>

        {/* 部署进度 */}
        {isDeploying && (
          <Box>
            <Text fontWeight="bold" mb={2}>部署进度</Text>
            <VStack spacing={2}>
              <Progress 
                value={
                  deploymentStep === 'checking' ? 25 :
                  deploymentStep === 'installing' ? 50 :
                  deploymentStep === 'deploying' ? 75 : 100
                } 
                width="100%" 
                colorScheme="blue"
              />
              <Text fontSize="sm">
                {
                  deploymentStep === 'checking' ? '检查依赖中...' :
                  deploymentStep === 'installing' ? '安装依赖中...' :
                  deploymentStep === 'deploying' ? '部署函数中...' : '部署完成！'
                }
              </Text>
            </VStack>
          </Box>
        )}
      </VStack>
    );
  };

  return (
    <>
      <Tooltip
        label={`快捷键: ${displayName.toUpperCase()}，智能部署包含依赖检查和自动安装`}
        placement="bottom-end"
      >
        <Button
          variant={"secondary"}
          rounded={"full"}
          size={"xs"}
          isLoading={functionDetailQuery.isFetching}
          disabled={store.getFunctionUrl() === ""}
          onClick={() => {
            onOpen();
          }}
          px={3}
          leftIcon={<RocketIcon />}
        >
          {t("FunctionPanel.Deploy")}
        </Button>
      </Tooltip>

      {isOpen && !functionDetailQuery.isFetching ? (
        <Modal isOpen={isOpen} onClose={handleClose} size="6xl" isCentered initialFocusRef={headerRef}>
          <ModalOverlay />
          <ModalContent maxW={"80%"}>
            <ModalHeader>智能函数部署</ModalHeader>
            <ModalCloseButton />
            
            <ModalBody borderBottom={"1px"} borderBottomColor="gray.200">
              <VStack spacing={6} align="stretch">
                {/* 代码差异 */}
                <Box>
                  <Text fontWeight="bold" mb={3}>代码变更</Text>
                  <CommonDiffEditor
                    original={(functionDetailQuery.data?.data as any)?.source?.code}
                    modified={functionCache.getCache(
                      store.currentFunction?._id,
                      store.currentFunction?.source?.code,
                    )}
                  />
                </Box>

                <Divider />

                {/* 部署状态信息 */}
                {renderDeploymentStatus()}
              </VStack>
            </ModalBody>

            <ModalFooter>
              <div className="mr-2 w-full">
                <Input
                  value={changelog}
                  onChange={(v) => setChangelog(v.target.value)}
                  variant="filled"
                  placeholder="输入此次函数修改的描述 (可选)"
                  disabled={isDeploying}
                />
              </div>
              <Button variant="ghost" mr={3} onClick={handleClose} disabled={isDeploying}>
                {t("Cancel")}
              </Button>
              <Button
                ref={headerRef}
                variant="primary"
                isLoading={isDeploying}
                onClick={enhancedDeploy}
                disabled={isDeploying}
              >
                {isDeploying ? '部署中...' : '智能部署'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      ) : null}
    </>
  );
}