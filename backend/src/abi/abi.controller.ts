import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AbiService, SupportedChain } from './abi.service';

@Controller('abi')
export class AbiController {
  private readonly logger = new Logger(AbiController.name);

  constructor(private readonly abiService: AbiService) {}

  /**
   * Fetch contract ABI from block explorer
   * GET /api/abi?address=0x...&chainId=1
   */
  @Get()
  async getContractAbi(
    @Query('address') address: string,
    @Query('chainId') chainId: string,
  ) {
    this.logger.log(`🔍 ABI Request received: address=${address}, chainId=${chainId}`);
    
    if (!address) {
      this.logger.warn('❌ Missing contract address in request');
      throw new HttpException('Contract address is required', HttpStatus.BAD_REQUEST);
    }

    if (!chainId) {
      this.logger.warn('❌ Missing chain ID in request');
      throw new HttpException('Chain ID is required', HttpStatus.BAD_REQUEST);
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      this.logger.warn(`❌ Invalid address format: ${address}`);
      throw new HttpException('Invalid contract address format', HttpStatus.BAD_REQUEST);
    }

    const chainIdNum = parseInt(chainId, 10);
    if (isNaN(chainIdNum)) {
      this.logger.warn(`❌ Invalid chain ID: ${chainId}`);
      throw new HttpException('Invalid chain ID', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`🚀 Fetching ABI for ${address} on chain ${chainIdNum}`);
      const result = await this.abiService.fetchContractAbi(address, chainIdNum);
      
      const functionCount = result.filter((item: any) => item.type === 'function').length;
      const writableFunctionCount = result.filter((item: any) => 
        item.type === 'function' && 
        (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable')
      ).length;
      
      this.logger.log(`✅ ABI fetched successfully: ${functionCount} functions (${writableFunctionCount} writable)`);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ ABI fetch failed for ${address}: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get supported chains
   * GET /api/abi/chains
   */
  @Get('chains')
  getSupportedChains(): SupportedChain[] {
    return this.abiService.getSupportedChains();
  }

  /**
   * Health check for ABI service
   * GET /api/abi/health
   */
  @Get('health')
  async healthCheck() {
    const isHealthy = await this.abiService.healthCheck();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'abi-fetcher',
    };
  }

  /**
   * Test Arbitrum Sepolia specifically
   * GET /api/abi/test-arbitrum
   */
  @Get('test-arbitrum')
  async testArbitrumSepolia() {
    const testAddress = '0x10025Ae0c53473E68Ff7DaeD5236436CaE604e56';
    const chainId = 421614;
    
    this.logger.log(`Testing Arbitrum Sepolia with verified contract: ${testAddress}`);
    
    try {
      const abi = await this.abiService.fetchContractAbi(testAddress, chainId);
      return {
        success: true,
        message: 'Arbitrum Sepolia API test successful',
        contractAddress: testAddress,
        contractName: 'MyNFT (verified)',
        chainId,
        chainName: 'Arbitrum Sepolia',
        abiLength: abi.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Arbitrum Sepolia test failed:', error.message);
      return {
        success: false,
        message: 'Arbitrum Sepolia API test failed',
        contractAddress: testAddress,
        chainId,
        chainName: 'Arbitrum Sepolia',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get cache statistics
   * GET /api/abi/cache/stats
   */
  @Get('cache/stats')
  getCacheStats() {
    return this.abiService.getCacheStats();
  }

  /**
   * Clear ABI cache
   * GET /api/abi/cache/clear
   */
  @Get('cache/clear')
  clearCache() {
    this.abiService.clearCache();
    return {
      success: true,
      message: 'ABI cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }
}