import { Injectable } from '@nestjs/common';
import { BaseDataService } from '../../../common/base.service';
import { DataStorageService } from '../../../shared/data-storage.service';

// Local interface definitions since entities were removed
interface GasAnalysis {
  id?: string;
  contractName?: string;
  analysisType?: string;
  contractInfo?: {
    contractName?: string;
    sourceCodeHash?: string;
    sourceCode?: string;
    contractPath?: string;
    language?: string;
    version?: string;
  };
  analysisConfig?: {
    analysisType?: string;
    gasEstimationType?: string;
    optimizationLevel?: string;
    targetNetworks?: string[];
    includeL2Networks?: boolean;
    maxRetries?: number;
    timeout?: number;
  };
  analysisResults?: {
    duration?: number;
    totalNetworks?: number;
    successfulNetworks?: number;
    failedNetworks?: string[];
    averageGasCost?: number;
    lowestGasCost?: { network: string; gasUsed: number };
    highestGasCost?: { network: string; gasUsed: number };
    gasSavings?: { amount: number; percentage: number };
  };
  metadata?: {
    networks?: string[];
    solidityVersion?: string;
    optimizationSettings?: any;
    functionCalls?: any[];
    totalNetworks?: number;
    successfulNetworks?: number;
    failedNetworks?: string[];
    optimizationLevel?: string;
    gasEstimationType?: string;
  };
  compilation?: any;
  networkResults?: NetworkResult[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface NetworkResult {
  id?: string;
  network?: string;
  networkDisplayName?: string;
  chainId?: number;
  gasEstimates?: any;
  deploymentGas?: any;
  functionGasEstimates?: any;
  deploymentCost?: number;
  executionCosts?: any;
  timestamp?: string;
  contractAddress?: string;
  transactionHash?: string;
  blockNumber?: number;
  networkStatus?: {
    isConnected?: boolean;
    latency?: number;
    blockNumber?: number;
  };
  createdAt?: Date;
}

interface CompilationResult {
  id?: string;
  success?: boolean;
  errors?: string[];
  bytecode?: string;
  abi?: any[];
  metadata?: any;
  bytecodeAnalysis?: any;
}
import {
  CompareNetworksRequestDto,
  NetworkComparisonDto,
  GasAnalysisQueryDto,
  GasAnalysisResultDto,
  OptimizationLevel,
  GasEstimationType,
  AnalysisType,
} from '../../../common/dto/gas-analysis.dto';
import {
  PaginatedResponseDto,
  SuccessResponseDto,
  PaginationMetaDto,
} from '../../../common/dto/base.dto';
import { ContractCompilationService } from './contract-compilation.service';
import { NetworkAnalysisService } from './network-analysis.service';
import { GasEstimationService } from './gas-estimation.service';
import { ValidationUtils, NumberUtils } from '../../../common/utils';
import { CONSTANTS } from '../../../common/constants';

@Injectable()
export class NetworkComparisonService extends BaseDataService<any> {
  constructor(
    private readonly dataStorageService: DataStorageService,
    private readonly compilationService: ContractCompilationService,
    private readonly networkAnalysisService: NetworkAnalysisService,
    private readonly gasEstimationService: GasEstimationService,
  ) {
    super(dataStorageService, 'gasAnalyses');
  }

  /**
   * Compare gas costs across multiple networks
   */
  async compareNetworks(
    request: CompareNetworksRequestDto,
  ): Promise<SuccessResponseDto<NetworkComparisonDto>> {
    try {
      this.logger.log(
        `Starting network comparison for contract: ${request.contractName}`,
      );

      // Validate networks
      const allNetworks = [request.baselineNetwork, ...request.comparisonNetworks];
      this.validateNetworks(allNetworks);

      // Compile contract
      const compilationResult = await this.compilationService.compileContract({
        contractName: request.contractName,
        sourceCode: request.sourceCode,
        solidityVersion: request.solidityVersion || '0.8.19',
        optimizationLevel: OptimizationLevel.MEDIUM,
        optimizationRuns: request.optimizationSettings?.runs || 200,
      });

      if (!compilationResult.success) {
        throw new Error(
          `Compilation failed: ${compilationResult.errors?.join(', ')}`,
        );
      }

      // Analyze gas costs for each network
      const networkResults = await Promise.all(
        allNetworks.map(async (networkId) => {
          const result = await this.networkAnalysisService.analyzeNetwork({
            network: networkId,
            compilation: compilationResult,
            functionCalls: [],
            constructorArgs: [],
            gasEstimationType: 'both' as any
          });
          return result;
        }),
      );

      // Create gas analysis record
      const gasAnalysis = await this.createGasAnalysisRecord(
        request,
        compilationResult,
        networkResults,
      );

      // Build comparison result
      const comparison = this.buildNetworkComparison(
        gasAnalysis,
        networkResults,
      );

      this.logger.log(
        `Network comparison completed for analysis ID: ${gasAnalysis.id}`,
      );

      return {
        success: true,
        message: 'Quick comparison completed successfully',
        data: comparison,
      };
    } catch (error) {
      this.logger.error(
        `Network comparison failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to compare networks: ${error.message}`);
    }
  }

  /**
   * Get comparison history with pagination
   */
  async getComparisonHistory(
    query: GasAnalysisQueryDto,
  ): Promise<PaginatedResponseDto<GasAnalysisResultDto>> {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = query;

      // Get all analyses and apply manual filtering
      const allAnalyses = await this.findAll();
      
      // Filter by analysis type
      let filteredAnalyses = allAnalyses.filter(analysis => 
        analysis.analysisConfig?.analysisType === 'network_comparison'
      );

      // Apply filters
      if (filters.contractName) {
        filteredAnalyses = filteredAnalyses.filter(analysis =>
          analysis.contractInfo?.contractName?.toLowerCase().includes(filters.contractName?.toLowerCase() || '')
        );
      }

      if (filters.network) {
        filteredAnalyses = filteredAnalyses.filter(analysis =>
          analysis.networkResults?.some(result => result.network === filters.network)
        );
      }

      if (filters.dateRange?.startDate) {
        filteredAnalyses = filteredAnalyses.filter(analysis =>
          new Date(analysis.createdAt) >= new Date(filters.dateRange?.startDate || new Date())
        );
      }

      if (filters.dateRange?.endDate) {
        filteredAnalyses = filteredAnalyses.filter(analysis =>
          new Date(analysis.createdAt) <= new Date(filters.dateRange?.endDate || new Date())
        );
      }

      // Apply sorting
      const order = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      filteredAnalyses.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return order === 'ASC' ? dateA - dateB : dateB - dateA;
      });

      const total = filteredAnalyses.length;
      
      // Apply pagination
      const offset = ((page || 1) - 1) * (limit || CONSTANTS.PAGINATION.DEFAULT_LIMIT);
      const analyses = filteredAnalyses.slice(offset, offset + (limit || CONSTANTS.PAGINATION.DEFAULT_LIMIT));

      const results = analyses.map((analysis) =>
        this.mapToGasAnalysisResult(analysis),
      );

      const meta = new PaginationMetaDto(
        page || 1,
        limit || CONSTANTS.PAGINATION.DEFAULT_LIMIT,
        total
      );

      return new PaginatedResponseDto(
        results,
        meta,
        'Comparison history retrieved successfully'
      );
    } catch (error) {
      this.logger.error(
        `Failed to get comparison history: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to retrieve comparison history');
    }
  }

  /**
   * Get comparison by ID
   */
  async getComparisonById(
    id: string,
  ): Promise<SuccessResponseDto<GasAnalysisResultDto>> {
    try {
      ValidationUtils.validateUUID(id);

      const analysis = await this.findById(id);

      if (!analysis) {
        throw new Error('Network comparison not found');
      }

      const result = this.mapToGasAnalysisResult(analysis);

      return {
        success: true,
        message: 'Network comparison retrieved successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get comparison by ID: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to retrieve network comparison');
    }
  }

  /**
   * Perform quick comparison between two networks
   */
  async quickComparison(
    network1: string,
    network2: string,
    contractBytecode: string,
  ): Promise<SuccessResponseDto<any>> {
    try {
      this.logger.log(
        `Starting quick comparison between ${network1} and ${network2}`,
      );

      // Validate networks
      this.validateNetworks([network1, network2]);

      // Get gas estimates for both networks
      const [result1, result2] = await Promise.all([
        this.networkAnalysisService.analyzeNetwork({
          network: network1,
          compilation: { success: true, bytecode: contractBytecode, abi: [], compilerVersion: '0.8.19', optimizationSettings: { enabled: false, runs: 200 } },
          functionCalls: [],
          constructorArgs: [],
          gasEstimationType: 'both' as any
        }),
        this.networkAnalysisService.analyzeNetwork({
          network: network2,
          compilation: { success: true, bytecode: contractBytecode, abi: [], compilerVersion: '0.8.19', optimizationSettings: { enabled: false, runs: 200 } },
          functionCalls: [],
          constructorArgs: [],
          gasEstimationType: 'both' as any
        }),
      ]);

      // Calculate comparison metrics
      const comparison = {
        network1: {
          id: network1,
          name: result1.networkDisplayName,
          deploymentCost: result1.deploymentGas,
          gasPrice: result1.deploymentGas.gasPrice,
          totalCostUSD: result1.deploymentGas.totalCostUSD,
        },
        network2: {
          id: network2,
          name: result2.networkDisplayName,
          deploymentCost: result2.deploymentGas,
          gasPrice: result2.deploymentGas.gasPrice,
          totalCostUSD: result2.deploymentGas.totalCostUSD,
        },
        savings: {
          gasDifference: result1.deploymentGas.gasLimit - result2.deploymentGas.gasLimit,
          costDifferenceUSD: result1.deploymentGas.totalCostUSD - result2.deploymentGas.totalCostUSD,
          percentageSaving: Math.abs(result1.deploymentGas.totalCostUSD - result2.deploymentGas.totalCostUSD) / Math.max(result1.deploymentGas.totalCostUSD, result2.deploymentGas.totalCostUSD) * 100,
          cheaperNetwork: result1.deploymentGas.totalCostUSD < result2.deploymentGas.totalCostUSD ? network1 : network2,
        },
        timestamp: new Date().toISOString(),
      };

      return this.createSuccessResponse(
        comparison,
        'Quick network comparison completed successfully'
      );
    } catch (error) {
      this.logger.error(
        `Quick comparison failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to perform quick comparison: ${error.message}`);
    }
  }

  /**
   * Get supported networks for comparison
   */
  async getSupportedNetworks(): Promise<SuccessResponseDto<any[]>> {
    try {
      const networks = [
        {
          id: 'ethereum',
          name: 'Ethereum Mainnet',
          chainId: 1,
          type: 'mainnet',
          gasToken: 'ETH',
          averageBlockTime: 12,
          supported: true,
        },
        {
          id: 'arbitrum',
          name: 'Arbitrum One',
          chainId: 42161,
          type: 'l2',
          gasToken: 'ETH',
          averageBlockTime: 0.25,
          supported: true,
        },
        {
          id: 'optimism',
          name: 'Optimism',
          chainId: 10,
          type: 'l2',
          gasToken: 'ETH',
          averageBlockTime: 2,
          supported: true,
        },
        {
          id: 'polygon',
          name: 'Polygon PoS',
          chainId: 137,
          type: 'sidechain',
          gasToken: 'MATIC',
          averageBlockTime: 2,
          supported: true,
        },
        {
          id: 'base',
          name: 'Base',
          chainId: 8453,
          type: 'l2',
          gasToken: 'ETH',
          averageBlockTime: 2,
          supported: true,
        },
        {
          id: 'polygon-zkevm',
          name: 'Polygon zkEVM',
          chainId: 1101,
          type: 'l2',
          gasToken: 'ETH',
          averageBlockTime: 5,
          supported: true,
        },
        {
          id: 'zksync-era',
          name: 'zkSync Era',
          chainId: 324,
          type: 'l2',
          gasToken: 'ETH',
          averageBlockTime: 1,
          supported: true,
        },
      ];

      return {
        success: true,
        message: 'Supported networks retrieved successfully',
        data: networks,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get supported networks: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to retrieve supported networks');
    }
  }

  /**
   * Get popular network pairs for comparison
   */
  async getPopularNetworkPairs(): Promise<SuccessResponseDto<any[]>> {
    try {
      const popularPairs = [
        {
          pair: ['ethereum', 'arbitrum'],
          name: 'Ethereum vs Arbitrum',
          description: 'Compare mainnet costs with L2 scaling solution',
          avgSavings: '85%',
          popularity: 95,
        },
        {
          pair: ['ethereum', 'optimism'],
          name: 'Ethereum vs Optimism',
          description: 'Compare mainnet costs with optimistic rollup',
          avgSavings: '80%',
          popularity: 90,
        },
        {
          pair: ['ethereum', 'polygon'],
          name: 'Ethereum vs Polygon PoS',
          description: 'Compare mainnet costs with sidechain solution',
          avgSavings: '95%',
          popularity: 85,
        },
        {
          pair: ['arbitrum', 'optimism'],
          name: 'Arbitrum vs Optimism',
          description: 'Compare L2 scaling solutions',
          avgSavings: '15%',
          popularity: 75,
        },
        {
          pair: ['ethereum', 'base'],
          name: 'Ethereum vs Base',
          description: 'Compare mainnet costs with Coinbase L2',
          avgSavings: '82%',
          popularity: 70,
        },
        {
          pair: ['ethereum', 'polygon-zkevm'],
          name: 'Ethereum vs Polygon zkEVM',
          description: 'Compare mainnet costs with zkEVM solution',
          avgSavings: '88%',
          popularity: 65,
        },
        {
          pair: ['ethereum', 'zksync-era'],
          name: 'Ethereum vs zkSync Era',
          description: 'Compare mainnet costs with zero-knowledge rollup',
          avgSavings: '90%',
          popularity: 68,
        },
      ];

      return {
        success: true,
        message: 'Popular network pairs retrieved successfully',
        data: popularPairs,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get popular network pairs: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to retrieve popular network pairs');
    }
  }

  /**
   * Validate network IDs
   */
  public validateNetworks(networks: string[]): void {
    const supportedNetworks = [
      // Mainnets
      'ethereum',
      'arbitrum',
      'optimism',
      'polygon',
      'base',
      'polygon-zkevm',
      'zksync-era',
      // Testnets
      'sepolia',
      'arbitrumSepolia',
      'arbitrum-sepolia',
      'optimismSepolia',
      'optimism-sepolia',
      'baseSepolia',
      'base-sepolia',
      'polygonAmoy',
      'polygonZkEvm',
      'zkSyncSepolia',
      // Local networks
      'hardhat',
      'localhost',
    ];

    for (const network of networks) {
      if (!supportedNetworks.includes(network)) {
        throw new Error(`Unsupported network: ${network}`);
      }
    }

    if (networks.length < 2) {
      throw new Error('At least 2 networks are required for comparison');
    }

    if (networks.length > 5) {
      throw new Error('Maximum 5 networks can be compared at once');
    }
  }

  /**
   * Create gas analysis record
   */
  private async createGasAnalysisRecord(
    request: CompareNetworksRequestDto,
    compilationResult: any,
    networkResults: any[],
  ): Promise<GasAnalysis> {
    const startTime = Date.now();

    // Save compilation result
    const compilation = {
      success: compilationResult.success,
      bytecode: compilationResult.bytecode,
      abi: compilationResult.abi,
      compilerVersion: compilationResult.compilerVersion,
      optimizationSettings: {
        enabled: compilationResult.optimizationEnabled || false,
        runs: compilationResult.optimizationRuns || 200,
      },
      bytecodeSize: compilationResult.bytecodeSize,
      errors: compilationResult.errors,
      warnings: compilationResult.warnings,
      compilationTime: compilationResult.compilationTime,
      gasEstimates: compilationResult.gasEstimates,
      bytecodeAnalysis: compilationResult.bytecodeAnalysis,
    };

    const savedCompilation: CompilationResult = await this.dataStorageService.create('compilationResults', compilation) as unknown as CompilationResult;

    // Create and save network results first
    const networkResultEntities = networkResults.map((result) => {
      return {
        networkInfo: {
          network: result.networkId || result.network,
          networkDisplayName: result.networkName || result.networkDisplayName,
          chainId: result.chainId
        },
        transactionInfo: {
          timestamp: result.timestamp,
          contractAddress: result.contractAddress,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber
        },
        deploymentGas: result.deploymentGas,
        functionGasEstimates: result.functionGasEstimates,
        networkStatus: result.networkStatus ? {
          blockNumber: result.networkStatus.blockNumber || 0,
          chainId: result.chainId || 0,
          isConnected: result.networkStatus.isConnected || false,
          lastChecked: new Date().toISOString(),
          latency: result.networkStatus.latency || 0,
          gasPrice: result.networkStatus.gasPrice,
          baseFee: result.networkStatus.baseFee,
        } : undefined,
        analysisMetadata: {
          analysisTime: Date.now(),
          ...result.metadata
        },
      };
    });

    const savedNetworkResults: NetworkResult[] = [];
    for (const entity of networkResultEntities) {
      const saved = await this.dataStorageService.create('networkResults', entity) as unknown as NetworkResult;
      savedNetworkResults.push(saved);
    }

    // Create gas analysis
    const gasAnalysis: GasAnalysis = {} as GasAnalysis;
    gasAnalysis.contractInfo = {
      contractName: request.contractName,
      contractPath: '',
      language: 'solidity',
      version: request.solidityVersion || '0.8.19'
    };
    gasAnalysis.analysisConfig = {
      analysisType: 'network_comparison',
      optimizationLevel: 'medium',
      targetNetworks: [request.baselineNetwork, ...request.comparisonNetworks],
      includeL2Networks: true,
      maxRetries: 3,
      timeout: 30000
    };
    gasAnalysis.analysisResults = {
      duration: Date.now() - startTime,
      totalNetworks: [request.baselineNetwork, ...request.comparisonNetworks].length,
      successfulNetworks: savedNetworkResults.length,
      failedNetworks: [],
      averageGasCost: 0,
      lowestGasCost: { network: '', gasUsed: 0 },
      highestGasCost: { network: '', gasUsed: 0 },
      gasSavings: { amount: 0, percentage: 0 }
    };
    gasAnalysis.metadata = {
      networks: [request.baselineNetwork, ...request.comparisonNetworks],
      solidityVersion: request.solidityVersion,
      optimizationSettings: request.optimizationSettings,
      functionCalls: request.functionCalls,
    };
    gasAnalysis.compilation = savedCompilation;
    gasAnalysis.networkResults = savedNetworkResults;

    return await this.create(gasAnalysis as GasAnalysis);
  }

  /**
   * Build network comparison result
   */
  private buildNetworkComparison(
    gasAnalysis: GasAnalysis,
    networkResults: any[],
  ): NetworkComparisonDto {
    const networks = networkResults.map((result) => ({
      networkId: result.networkId || result.network,
      networkName: result.networkName || result.networkDisplayName || result.network,
      chainId: result.chainId,
      deploymentCost: result.deploymentGas,
      gasPrice: result.deploymentGas?.gasPrice,
      totalCostUSD: result.totalCostUSD || (result.deploymentGas?.gasCostUSD || 0),
      savings: 0, // Will be calculated below
      rank: 0, // Will be calculated below
    }));

    // Sort by total cost and calculate savings
    networks.sort((a, b) => a.totalCostUSD - b.totalCostUSD);
    const cheapestCost = networks[0].totalCostUSD;
    const mostExpensiveCost = networks[networks.length - 1].totalCostUSD;

    networks.forEach((network, index) => {
      network.rank = index + 1;
      network.savings = NumberUtils.calculatePercentage(
        mostExpensiveCost - network.totalCostUSD,
        mostExpensiveCost,
      );
    });

    // For now, return a simplified structure that matches NetworkComparisonDto
    // This needs to be properly implemented based on the actual DTO structure
    const baseline = networkResults[0];
    const comparisons = networkResults.slice(1);
    
    return {
      baseline: {
        network: baseline.network,
        networkDisplayName: baseline.networkDisplayName || baseline.network,
        chainId: baseline.chainId,
        deploymentGas: baseline.deploymentGas || { gasLimit: 0, gasPrice: 0, totalCost: '0', totalCostUSD: 0 },
        functionGasEstimates: baseline.functionGasEstimates || {},
        timestamp: baseline.timestamp || new Date().toISOString(),
        contractAddress: baseline.contractAddress,
        transactionHash: baseline.transactionHash,
        blockNumber: baseline.blockNumber,
      },
      comparisons: comparisons.map(comp => ({
        network: {
          network: comp.network,
          networkDisplayName: comp.networkDisplayName || comp.network,
          chainId: comp.chainId,
          deploymentGas: comp.deploymentGas || { gasLimit: 0, gasPrice: 0, totalCost: '0', totalCostUSD: 0 },
          functionGasEstimates: comp.functionGasEstimates || {},
          timestamp: comp.timestamp || new Date().toISOString(),
          contractAddress: comp.contractAddress,
          transactionHash: comp.transactionHash,
          blockNumber: comp.blockNumber,
        },
        savings: {
          deploymentSavings: { absolute: '0', percentage: 0, gasReduction: 0 },
          functionSavings: {},
          totalSavings: { absolute: '0', percentage: 0 },
        },
      })),
      metadata: {
        comparisonId: gasAnalysis.id || '',
        timestamp: gasAnalysis.createdAt?.toISOString() || new Date().toISOString(),
        contractName: gasAnalysis.contractInfo?.contractName || 'Unknown',
        baselineNetwork: baseline.network,
        comparisonNetworks: comparisons.map(c => c.network),
      },
    };
  }

  /**
   * Map gas analysis entity to result DTO
   */
  private mapToGasAnalysisResult(analysis: GasAnalysis): GasAnalysisResultDto {
    return {
      id: analysis.id || '',
      contractName: analysis.contractInfo?.contractName || 'Unknown',
      analysisType: (analysis.analysisConfig?.analysisType || 'basic') as AnalysisType,
      duration: analysis.analysisResults?.duration || 0,
      createdAt: analysis.createdAt?.toISOString() || new Date().toISOString(),
      compilation: analysis.compilation
        ? {
            success: analysis.compilation.success,
            bytecode: analysis.compilation.bytecode || '',
            abi: analysis.compilation.abi || [],
            compilerVersion: analysis.compilation.compilerVersion || '0.8.19',
            optimizationSettings: {
              enabled: analysis.compilation.isOptimized || false,
              runs: analysis.compilation.optimizationRuns || 200,
            },
            errors: analysis.compilation.errors,
            warnings: analysis.compilation.warnings,
            compilationTime: analysis.compilation.compilationTime,
            bytecodeSize: analysis.compilation.bytecodeSize,
            gasEstimates: analysis.compilation.gasEstimates,
            bytecodeAnalysis: analysis.compilation.bytecodeAnalysis ? {
              size: analysis.compilation.bytecodeSize || 0,
              complexityScore: analysis.compilation.bytecodeAnalysis.complexity || 0,
              opcodeCount: analysis.compilation.bytecodeAnalysis.opcodeDistribution ? Object.keys(analysis.compilation.bytecodeAnalysis.opcodeDistribution).length : 0,
              topOpcodes: analysis.compilation.bytecodeAnalysis.opcodeDistribution ? Object.entries(analysis.compilation.bytecodeAnalysis.opcodeDistribution).map(([opcode, count]) => ({
                opcode,
                count: typeof count === 'number' ? count : 0,
                percentage: 0, // Would need total count to calculate percentage
              })) : [],
              deploymentCostMultiplier: 1,
            } : undefined,
          }
        : {
            success: false,
            bytecode: '',
            abi: [],
            compilerVersion: '0.8.19',
            optimizationSettings: { enabled: false, runs: 200 },
          },
      networkResults: analysis.networkResults?.map((result) => ({
        network: result.network || 'unknown',
        networkDisplayName: result.networkDisplayName || result.network || 'unknown',
        chainId: result.chainId || 0,
        deploymentGas: {
           gasLimit: result.deploymentGas?.gasUsed || 0,
           gasPrice: (result.deploymentGas?.gasPrice || 0) / 1e9, // Convert wei to gwei
           totalCost: result.deploymentGas?.gasCost || '0',
           totalCostUSD: result.deploymentGas?.gasCostUSD || 0,
           gasUsed: result.deploymentGas?.gasUsed,
           effectiveGasPrice: result.deploymentGas?.gasPrice,
           gasCost: result.deploymentGas?.gasCost,
         },
        functionGasEstimates: result.functionGasEstimates || {},
        timestamp: result.timestamp || new Date().toISOString(),
        contractAddress: result.contractAddress,
        blockNumber: result.blockNumber,
        transactionHash: result.transactionHash,
        networkStatus: result.networkStatus ? {
          isOnline: result.networkStatus.isConnected ?? false,
          latency: result.networkStatus.latency || 0,
          blockHeight: result.networkStatus.blockNumber || 0,
        } : undefined,
      })) || [],
      metadata: analysis.metadata ? {
        solidityVersion: analysis.metadata.solidityVersion || '',
        optimizationLevel: (analysis.metadata.optimizationLevel as OptimizationLevel) || OptimizationLevel.MEDIUM,
        gasEstimationType: (analysis.metadata.gasEstimationType as GasEstimationType) || GasEstimationType.BOTH,
        totalNetworks: analysis.metadata.totalNetworks || 0,
        successfulNetworks: analysis.metadata.successfulNetworks || 0,
        failedNetworks: analysis.metadata.failedNetworks || [],
      } : undefined,
    };
  }

  /**
   * Generate source code hash
   */
  private generateSourceCodeHash(sourceCode: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sourceCode).digest('hex');
  }

  /**
   * Quick comparison between networks (simplified version)
   */
  async quickCompare(request: CompareNetworksRequestDto): Promise<any> {
    try {
      this.logger.log(
        `Starting quick comparison for contract: ${request.contractName}`,
      );

      // Validate networks
      const allNetworks = [request.baselineNetwork, ...request.comparisonNetworks];
      this.validateNetworks(allNetworks);

      // For quick comparison, we'll use the existing quickComparison method
      // with the first comparison network
      const comparisonNetwork = request.comparisonNetworks[0];
      
      return await this.quickComparison(
        request.baselineNetwork,
        comparisonNetwork,
        request.sourceCode, // Using source code as bytecode for now
      );
    } catch (error) {
      this.logger.error(
        `Failed to perform quick comparison: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}