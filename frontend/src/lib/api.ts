// Import shared types
import { NetworkResult, GasEstimate, NetworkComparison, FunctionComparison } from '@/types/shared';

export interface GasAnalysis {
  id: string;
  contractName: string;
  functionSignature: string;
  l2Network: string;
  gasUsed: string;
  estimatedL2Fee: string;
  estimatedL1Fee: string;
  totalEstimatedFeeUSD: number;
  solidityCode: string;
  compilationArtifacts: any;
  functionParameters: any;
  createdAt: string;
}

export interface BenchmarkSession {
    id?: number;
    sessionName?: string;
    results: {
      transactions: {
        totalTransactions: number;
        successfulTransactions: number;
        failedTransactions: number;
        totalGasUsed: string;
        totalFees: string;
      };
    };
    totalOperations: number;
    avgGasUsed: number;
    avgExecutionTime: number;
    createdAt?: string;
  }

export interface ComparisonReport {
  id: number;
  contractName: string;
  networks: {
    name: string;
    deploymentGas: string;
    deploymentFee: string;
    functions: {
      signature: string;
      gasUsed: string;
      estimatedFee: string;
    }[];
  }[];
  solidityCode: string;
  compilationArtifacts: any;
  totalGasDifference: string;
  savingsPercentage: number;
  createdAt: string;
  timestamp: string;
}

export interface ComparisonResult {
  contractName: string;
  timestamp: string;
  local: NetworkResult;
  comparisons: NetworkComparison[];
  overallSummary: {
    bestNetwork: NetworkComparison;
    averageSavings: number;
  };
}

// NetworkComparison and FunctionComparison are now imported from shared types

// NetworkResult is now imported from shared types
  
  class ApiService {
    private baseUrl = 'http://localhost:3001/api';
  
    async createBenchmarkSession(data: Omit<BenchmarkSession, 'id' | 'createdAt'>): Promise<BenchmarkSession> {
      const response = await fetch(`${this.baseUrl}/benchmark/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to create benchmark session: ${response.statusText}`);
      }
  
      return response.json();
    }
  
    async getBenchmarkSessions(): Promise<BenchmarkSession[]> {
      const response = await fetch(`${this.baseUrl}/benchmark/sessions`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to fetch benchmark sessions: ${response.statusText}`);
      }
  
      return response.json();
    }
  
    async getBenchmarkSession(id: number): Promise<BenchmarkSession> {
      const response = await fetch(`${this.baseUrl}/benchmark/sessions/${id}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to fetch benchmark session: ${response.statusText}`);
      }
  
      return response.json();
    }
  
  // Gas Analysis methods
  async analyzeContract(data: {
    code: string;
    networks: string[];
    contractName: string;
    saveToDatabase?: boolean;
    confidenceLevel?: number;
  }) {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to analyze contract: ${response.statusText}`);
    }

    return response.json();
  }

  // New method for sequential network analysis with forking
  async analyzeNetworkSequentially(data: {
    code: string;
    network: string;
    contractName: string;
    confidenceLevel?: number;
  }) {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/analyze-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to analyze network ${data.network}: ${response.statusText}`);
    }

    return response.json();
  }

  // Note: Progress tracking is handled on the frontend side
  // No backend endpoint needed for progress updates

  async compareLocalVsL2(request: {
    code: string;
    contractName: string;
    l2Networks: string[];
    saveToDatabase: boolean;
    confidenceLevel?: number;
  }): Promise<ComparisonResult> {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Comparison analysis failed');
    }

    return response.json();
  }

  async getGasAnalysisHistory(limit?: number): Promise<GasAnalysis[]> {
    const url = limit ? `${this.baseUrl}/gas-analyzer/history?limit=${limit}` : `${this.baseUrl}/gas-analyzer/history`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch gas analysis history: ${response.statusText}`);
    }

    return response.json();
  }

  async getGasAnalysisByContract(contractName: string): Promise<GasAnalysis[]> {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/contract/${contractName}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch gas analysis for contract: ${response.statusText}`);
    }

    return response.json();
  }

  async getGasAnalysisById(id: string): Promise<GasAnalysis> {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/analysis/${id}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch gas analysis: ${response.statusText}`);
    }

    return response.json();
  }

  // Comparison Reports methods
  async getComparisonReports(limit?: number): Promise<ComparisonReport[]> {
    const url = limit ? `${this.baseUrl}/gas-analyzer/comparison-reports?limit=${limit}` : `${this.baseUrl}/gas-analyzer/comparison-reports`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch comparison reports: ${response.statusText}`);
    }

    return response.json();
  }

  async compareBlobCosts(request: {
    l2Networks: string[];
    blobDataSize?: number;
    confidenceLevel?: number;
    saveToDatabase?: boolean;
  }) {
    // Send l2Networks directly to match backend expectation
    const backendRequest = {
      l2Networks: request.l2Networks,
      blobDataSize: request.blobDataSize,
      confidenceLevel: request.confidenceLevel,
      saveToDatabase: request.saveToDatabase
    };
    
    const response = await fetch(`${this.baseUrl}/gas-analyzer/blob-cost-comparison`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Blob cost analysis failed');
    }

    return response.json();
  }

  async getComparisonReportById(id: number): Promise<ComparisonReport> {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/comparison-reports/${id}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch comparison report: ${response.statusText}`);
    }

    return response.json();
  }

  async getComparisonReportsStats(): Promise<{
    totalReports: number;
    avgGasDifference: string;
    avgSavingsPercentage: number;
    latestReport?: ComparisonReport;
  }> {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/comparison-reports/stats`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch comparison reports stats: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteComparisonReport(id: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/gas-analyzer/comparison-reports/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to delete comparison report: ${response.statusText}`);
    }
  }
  }

// Live Network Forker API
class LiveNetworkForkerApi {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  async setupNetwork(networkName: string) {
    const response = await fetch(`${this.baseUrl}/live-network-forker/setup-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ networkName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to setup network: ${response.statusText}`);
    }

    return response.json();
  }

  async compileContract(data: { contractCode: string; contractName?: string }) {
    console.log('🔧 API compileContract called with:', data);
    const response = await fetch(`${this.baseUrl}/live-benchmarker/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contractCode: data.contractCode, contractName: data.contractName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to compile contract: ${response.statusText}`);
    }

    return response.json();
  }

  async getActiveBenchmarks() {
    const response = await fetch(`${this.baseUrl}/live-benchmarker/active`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch active benchmarks: ${response.statusText}`);
    }

    return response.json();
  }

  async validateFunctions(data: {
    benchmarkId: string;
    contractCode: string;
    constructorArgs?: any[];
    functionCalls: Array<{
      functionName: string;
      parameters: any[];
    }>;
    solidityVersion?: string;
    contractAddress?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/live-network-forker/validate-functions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to validate functions: ${response.statusText}`);
    }

    return response.json();
  }

  async runLiveNetworkFork(data: {
    benchmarkId: string;
    contractCode: string;
    constructorArgs?: any[];
    functionCalls?: Array<{
      functionName: string;
      parameters: any[];
    }>;
    solidityVersion?: string;
    contractAddress?: string;
  }) {
    const response = await fetch(`${this.baseUrl}/live-network-forker/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to run live network fork: ${response.statusText}`);
    }

    return response.json();
  }

  async cleanupBenchmark(benchmarkId: string) {
    const response = await fetch(`${this.baseUrl}/live-benchmarker/${benchmarkId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to cleanup benchmark: ${response.statusText}`);
    }

    return response.json();
  }

  async cleanupAllBenchmarks() {
    const response = await fetch(`${this.baseUrl}/live-network-forker/cleanup-all`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to cleanup all benchmarks: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiService = new ApiService();
export const liveNetworkForkerApi = new LiveNetworkForkerApi();
// export type { BenchmarkSession, GasAnalysis };