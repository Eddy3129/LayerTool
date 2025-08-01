import { Controller, Post, Get, Body, Query, Param, HttpException, HttpStatus, Delete } from '@nestjs/common';
import { GasAnalyzerService } from './gas-analyzer.service';
import { ComparisonReportService } from './comparison-report.service';
import { ValidationUtils } from '../shared/validation-utils';
import { AnalyzeContractRequest, CompareNetworksRequest } from '../shared/types';

// Local interface definitions
interface GasAnalysis {
  id: string;
  contractName: string;
  sourceCode: string;
  analysisType: any;
  networks: string[];
  results: any;
  createdAt: Date;
  updatedAt: Date;
}

interface ComparisonReport {
  id: string;
  reportName: string;
  networksCompared: string[];
  comparisonConfig: any;
  savingsBreakdown: any;
  executiveSummary: any;
  chartData: any;
  metadata: any;
  totalGasDifference: number;
  savingsPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

@Controller('gas-analyzer')
export class GasAnalyzerController {
  constructor(
    private readonly gasAnalyzerService: GasAnalyzerService,
    private readonly comparisonReportService: ComparisonReportService
  ) {}

  @Post('analyze')
  async analyzeContract(@Body() body: AnalyzeContractRequest) {
    // Validate request using centralized validation
    ValidationUtils.validateAnalyzeContractRequest(body);
    
    const { code, networks, contractName, confidenceLevel = 70, saveToDatabase = false } = body;
    
    try {
      const result = await this.gasAnalyzerService.analyzeContract(code, networks, contractName, confidenceLevel);
      
      // Note: Database saving has been moved to the new gas-analysis module
      // Use the gas-analysis module endpoints for saving analysis results
      
      return result;
    } catch (error) {
      // Handle compilation errors specifically
      if (error.message && error.message.includes('Compilation failed')) {
        throw ValidationUtils.createCompilationError(error.message);
      }
      
      // Handle validation errors
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle other service errors
      if (error.message) {
        throw ValidationUtils.createValidationError([error.message]);
      }
      
      // Fallback for unknown errors
      throw ValidationUtils.createInternalServerError('Internal server error during contract analysis');
    }
  }

  @Post('analyze-network')
  async analyzeNetwork(@Body() body: { code: string; network: string; contractName: string; confidenceLevel?: number }) {
    // Validate request
    if (!body.code || !body.network || !body.contractName) {
      throw ValidationUtils.createValidationError(['Code, network, and contract name are required']);
    }

    const { code, network, contractName, confidenceLevel = 70 } = body;
    
    try {
      // Use the existing service but for a single network
      const result = await this.gasAnalyzerService.analyzeContract(code, [network], contractName, confidenceLevel);
      
      // Return the result for the single network
      if (result.results && result.results.length > 0) {
        return {
          network: network,
          result: result.results[0],
          analysisMethod: 'SIMULATION' // Indicate this uses mainnet forking
        };
      } else {
        throw new Error(`No analysis result found for network: ${network}`);
      }
    } catch (error) {
      // Handle compilation errors specifically
      if (error.message && error.message.includes('Compilation failed')) {
        throw ValidationUtils.createCompilationError(error.message);
      }
      
      // Handle validation errors
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Handle other service errors
      if (error.message) {
        throw ValidationUtils.createValidationError([error.message]);
      }
      
      // Fallback for unknown errors
      throw ValidationUtils.createInternalServerError(`Internal server error during network analysis for ${network}`);
    }
  }
  
  @Get('history')
  async getAnalysisHistory(@Query('limit') limit?: string): Promise<GasAnalysis[]> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.gasAnalyzerService.getGasAnalysisHistory(limitNum);
  }

  @Get('contract/:contractName')
  async getAnalysisByContract(@Param('contractName') contractName: string): Promise<GasAnalysis[]> {
    return this.gasAnalyzerService.getGasAnalysisByContract(contractName);
  }

  @Get('analysis/:id')
  async getAnalysisById(@Param('id') id: string): Promise<GasAnalysis | null> {
    return this.gasAnalyzerService.getGasAnalysisById(id);
  }

  @Post('compare')
  async compareLocalVsL2(@Body() body: CompareNetworksRequest) {
    // Validate request using centralized validation
    ValidationUtils.validateCompareNetworksRequest(body);
    
    const { code, contractName, l2Networks, confidenceLevel = 70, saveToDatabase = false } = body;
    
    try {
      // Analyze Sepolia testnet as baseline (more realistic gas prices)
      const baselineResult = await this.gasAnalyzerService.analyzeContract(
        code, 
        ['sepolia'], 
        contractName,
        confidenceLevel
      );
      
      // Analyze L2 networks
      const l2Result = await this.gasAnalyzerService.analyzeContract(
        code, 
        l2Networks, 
        contractName,
        confidenceLevel
      );
      
      // Create comparison report
      const comparisonReport = this.generateComparisonReport(baselineResult, l2Result);
      
      // Save to database if requested
      if (saveToDatabase) {
        // Note: Database saving has been moved to the new gas-analysis module
        // Use the gas-analysis module endpoints for saving analysis results
        
        // Save comparison report
        await this.saveComparisonReport(comparisonReport, code);
      }
      
      return comparisonReport;
    } catch (error) {
      if (error.message && error.message.includes('Compilation failed')) {
        throw ValidationUtils.createCompilationError(error.message);
      }
      
      // Handle validation errors
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw ValidationUtils.createInternalServerError(error.message || 'Comparison analysis failed');
    }
  }

  @Post('blob-cost-comparison')
  async compareBlobCosts(@Body() body: {
    l2Networks: string[];
    blobDataSize?: number;
    confidenceLevel?: number;
    saveToDatabase?: boolean;
  }) {
    const { l2Networks, blobDataSize = 131072, confidenceLevel = 70, saveToDatabase = false } = body;
    
    try {
      // Validate L2 networks support EIP-4844
      const supportedL2s = ['arbitrum', 'optimism', 'base', 'polygon-zkevm', 'zksync-era', 'linea','ink','scroll'];
      const validL2s = l2Networks.filter(network => supportedL2s.includes(network));
      
      if (validL2s.length === 0) {
        throw ValidationUtils.createValidationError(['No valid EIP-4844 supporting L2 networks provided']);
      }
      
      const blobCostAnalysis = await this.gasAnalyzerService.analyzeBlobCosts(
        validL2s,
        blobDataSize,
        confidenceLevel
      );
      
      // Note: Database saving has been moved to the new gas-analysis module
      // Use the gas-analysis module endpoints for saving blob analysis results
      
      return blobCostAnalysis;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw ValidationUtils.createInternalServerError(error.message || 'Blob cost analysis failed');
    }
   }
  
  private generateComparisonReport(baselineResult: any, l2Result: any) {
    const baseline = baselineResult.results[0]; // Sepolia testnet result
    const l2Networks = l2Result.results;
    
    const comparisons = l2Networks.map(l2Network => {
      const deploymentSavings = {
        gasReduction: parseInt(baseline.deployment.gasUsed) - parseInt(l2Network.deployment.gasUsed),
        costSavingsETH: parseFloat(baseline.deployment.costETH) - parseFloat(l2Network.deployment.costETH),
        costSavingsUSD: baseline.deployment.costUSD - l2Network.deployment.costUSD,
        percentageSaving: ((baseline.deployment.costUSD - l2Network.deployment.costUSD) / baseline.deployment.costUSD * 100)
      };
      
      const functionComparisons = baseline.functions.map(baselineFunc => {
        const l2Func = l2Network.functions.find(f => f.functionName === baselineFunc.functionName);
        if (!l2Func) return null;
        
        return {
          functionName: baselineFunc.functionName,
          baseline: {
            gasUsed: baselineFunc.gasUsed,
            costETH: baselineFunc.estimatedCostETH,
            costUSD: baselineFunc.estimatedCostUSD
          },
          l2: {
            gasUsed: l2Func.gasUsed,
            costETH: l2Func.estimatedCostETH,
            costUSD: l2Func.estimatedCostUSD
          },
          savings: {
            gasReduction: parseInt(baselineFunc.gasUsed) - parseInt(l2Func.gasUsed),
            costSavingsETH: parseFloat(baselineFunc.estimatedCostETH) - parseFloat(l2Func.estimatedCostETH),
            costSavingsUSD: baselineFunc.estimatedCostUSD - l2Func.estimatedCostUSD,
            percentageSaving: ((baselineFunc.estimatedCostUSD - l2Func.estimatedCostUSD) / baselineFunc.estimatedCostUSD * 100)
          }
        };
      }).filter(Boolean);
      
      return {
        network: l2Network.network,
        gasPrice: l2Network.gasPrice,
        gasPriceBreakdown: l2Network.gasPriceBreakdown,
        deployment: {
          baseline: {
            gasUsed: baseline.deployment.gasUsed,
            costETH: baseline.deployment.costETH,
            costUSD: baseline.deployment.costUSD
          },
          l2: {
            gasUsed: l2Network.deployment.gasUsed,
            costETH: l2Network.deployment.costETH,
            costUSD: l2Network.deployment.costUSD
          },
          savings: deploymentSavings
        },
        functions: functionComparisons,
        summary: {
          totalLocalCost: baseline.deployment.costUSD + baseline.functions.reduce((sum, f) => sum + f.estimatedCostUSD, 0),
          totalL2Cost: l2Network.deployment.costUSD + l2Network.functions.reduce((sum, f) => sum + f.estimatedCostUSD, 0),
          totalSavings: deploymentSavings.costSavingsUSD + functionComparisons.reduce((sum, f) => sum + (f?.savings?.costSavingsUSD || 0), 0)
        }
      };
    });
    
    return {
      contractName: baselineResult.contractName,
      timestamp: new Date().toISOString(),
      local: {
        ...baseline,
        gasPrice: baseline.gasPrice,
        gasPriceBreakdown: baseline.gasPriceBreakdown
      },
      comparisons,
      overallSummary: {
        bestNetwork: comparisons.reduce((best, current) => 
          current.summary.totalSavings > best.summary.totalSavings ? current : best
        ),
        averageSavings: comparisons.reduce((sum, comp) => sum + comp.summary.totalSavings, 0) / comparisons.length
      }
    };
  }
  
  // Comparison Reports endpoints
  @Get('comparison-reports')
  async getComparisonReports(@Query('limit') limit?: string): Promise<ComparisonReport[]> {
    try {
      const limitNum = limit ? ValidationUtils.validatePaginationParams(limit).limit : undefined;
      return await this.comparisonReportService.getAllReports(limitNum);
    } catch (error) {
      throw ValidationUtils.createInternalServerError('Failed to retrieve comparison reports');
    }
  }

  @Get('comparison-reports/:id')
  async getComparisonReportById(@Param('id') id: string): Promise<ComparisonReport | null> {
    try {
      const report = await this.comparisonReportService.getReportById(id);
      if (!report) {
        throw ValidationUtils.createNotFoundError('Comparison report', id);
      }
      return report;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw ValidationUtils.createInternalServerError('Failed to retrieve comparison report');
    }
  }

  @Get('comparison-reports/stats')
  async getComparisonReportStats() {
    try {
      return await this.comparisonReportService.getReportStats();
    } catch (error) {
      throw ValidationUtils.createInternalServerError('Failed to retrieve comparison report statistics');
    }
  }

  @Delete('comparison-reports/:id')
  async deleteComparisonReport(@Param('id') id: string) {
    try {
      await this.comparisonReportService.deleteReport(id);
      return { message: 'Comparison report deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw ValidationUtils.createInternalServerError('Failed to delete comparison report');
    }
  }

  private async saveComparisonReport(comparisonReport: any, solidityCode: string) {
    // Transform comparison report data to match entity structure
    const networks = [
      {
        network: 'mainnet', // baseline (sepolia represents mainnet costs)
        deploymentGas: parseInt(comparisonReport.local.deployment.gasUsed),
        gasPrice: comparisonReport.local.gasPrice,
        deploymentCost: comparisonReport.local.deployment.costETH,
        functions: comparisonReport.local.functions.map(func => ({
          functionName: func.functionName,
          gasUsed: parseInt(func.gasUsed)
        }))
      },
      ...comparisonReport.comparisons.map(comp => ({
        network: comp.network,
        deploymentGas: parseInt(comp.deployment.l2.gasUsed),
        gasPrice: comp.gasPrice,
        deploymentCost: comp.deployment.l2.costETH,
        functions: comp.functions.map(func => ({
          functionName: func.functionName,
          gasUsed: parseInt(func.l2.gasUsed)
        }))
      }))
    ];

    const mainnetNetwork = networks.find(n => n.network === 'mainnet');
    const l2Network = networks.find(n => n.network !== 'mainnet');
    const totalGasDifference = mainnetNetwork && l2Network 
      ? mainnetNetwork.deploymentGas - l2Network.deploymentGas 
      : 0;
    const savingsPercentage = mainnetNetwork && l2Network && mainnetNetwork.deploymentGas > 0
      ? ((totalGasDifference / mainnetNetwork.deploymentGas) * 100)
      : 0;

    const reportData = {
      contractName: comparisonReport.contractName,
      networks,
      solidityCode,
      compilationArtifacts: {},
      totalGasDifference,
      savingsPercentage,
      timestamp: comparisonReport.timestamp
    };

    return await this.comparisonReportService.createReport(reportData);
  }

  @Get('multi-chain-gas-data')
  async getMultiChainGasData(
    @Query('chains') chains: string,
    @Query('confidenceLevel') confidenceLevel?: string
  ) {
    try {
      // Parse chains parameter
      const chainIds = chains ? chains.split(',').map(c => c.trim()) : ['polygon', 'arbitrum', 'optimism', 'base'];
      const confidence = confidenceLevel ? parseInt(confidenceLevel) : 99;
      
      // Validate confidence level
      if (confidence < 50 || confidence > 99) {
        throw new HttpException('Confidence level must be between 50 and 99', HttpStatus.BAD_REQUEST);
      }
      
      const result = await this.gasAnalyzerService.getMultiChainGasData(chainIds, confidence);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        metadata: {
          chainsRequested: chainIds.length,
          chainsReturned: result.length,
          confidenceLevel: confidence
        }
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch multi-chain gas data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('token-prices')
  async getTokenPrices(
    @Query('chains') chains: string
  ) {
    try {
      const chainIds = chains ? chains.split(',').map(c => c.trim()) : [];
      const result = await this.gasAnalyzerService.getTokenPrices(chainIds);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch token prices: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('ethereum-block-prices')
  async getEthereumBlockPrices() {
    try {
      const blockPrices = await this.gasAnalyzerService.getEthereumBlockPrices();
      return {
        success: true,
        data: blockPrices,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch Ethereum block prices: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Compilation error extraction moved to shared/validation-utils.ts
}