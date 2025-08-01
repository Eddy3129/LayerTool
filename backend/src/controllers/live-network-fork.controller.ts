import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Body,
  Param,
  HttpStatus,
  BadRequestException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { LiveNetworkForkService, LiveNetworkForkData } from '../services/live-network-fork.service';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Live Network Fork')
@Controller('live-network-fork')
export class LiveNetworkForkController {
  constructor(private readonly liveNetworkForkService: LiveNetworkForkService) {}

  @Post('store')
  @ApiOperation({
    summary: 'Store live benchmark data',
    description: 'Stores live benchmark results to the database with timestamp',
  })
  @ApiBody({
    description: 'Array of live benchmark data',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          network: { type: 'string', example: 'Arbitrum One' },
          contractName: { type: 'string', example: 'BasicToken' },
          functionName: { type: 'string', example: 'mint' },
          contractAddress: { type: 'string', example: '0x1234...5678', nullable: true },
          minGasUsed: { type: 'string', example: '36693' },
          maxGasUsed: { type: 'string', example: '53817' },
          avgGasUsed: { type: 'string', example: '40750' },
          l1DataBytes: { type: 'string', example: '249', nullable: true },
          executionCount: { type: 'number', example: 93 },
          avgCostUsd: { type: 'number', example: 0.0015159 },
          gasPriceGwei: { type: 'number', example: 0.03 },
          tokenPriceUsd: { type: 'number', example: 3721.69 },
          deploymentCostUsd: { type: 'number', example: 0.258583, nullable: true },
          l2ExecutionCostUsd: { type: 'number', example: 0.200000, nullable: true },
          l1DataCostUsd: { type: 'number', example: 0.058583, nullable: true },
          metadata: { type: 'object', nullable: true },
        },
        required: ['network', 'contractName', 'functionName', 'minGasUsed', 'maxGasUsed', 'avgGasUsed', 'executionCount', 'avgCostUsd', 'gasPriceGwei', 'tokenPriceUsd'],
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Live benchmark data stored successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            recordsStored: { type: 'number' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  })
  async storeNetworkForkData(@Body() networkForkData: LiveNetworkForkData[]) {
    try {
      if (!Array.isArray(networkForkData) || networkForkData.length === 0) {
        throw new BadRequestException('Live benchmark data array is required and cannot be empty');
      }

      // Validate required fields
      for (const data of networkForkData) {
        if (!data.network || !data.contractName || !data.functionName ||
            !data.minGasUsed || !data.maxGasUsed || !data.avgGasUsed ||
            typeof data.executionCount !== 'number' || 
            typeof data.avgCostUsd !== 'number' ||
            typeof data.gasPriceGwei !== 'number' ||
            typeof data.tokenPriceUsd !== 'number') {
          throw new BadRequestException('Invalid live benchmark data format. All required fields must be provided.');
        }
      }

      const records = await this.liveNetworkForkService.storeNetworkForkData(networkForkData);
      
      return {
        success: true,
        message: 'Live benchmark data stored successfully',
        data: {
          recordsStored: records.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message || 'Failed to store live benchmark data');
    }
  }

  @Get('records')
  @ApiOperation({
    summary: 'Get live benchmark records',
    description: 'Retrieves live benchmark records with optional filtering',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'networks', required: false, type: String, description: 'Comma-separated network names' })
  @ApiQuery({ name: 'contractNames', required: false, type: String, description: 'Comma-separated contract names' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of records' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of records to skip' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Live benchmark records retrieved successfully',
  })
  async getRecords(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('networks') networks?: string,
    @Query('contractNames') contractNames?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    try {
      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;
      const parsedNetworks = networks ? networks.split(',').map(n => n.trim()) : undefined;
      const parsedContractNames = contractNames ? contractNames.split(',').map(n => n.trim()) : undefined;
      const parsedLimit = limit ? parseInt(limit, 10) : 100;
      const parsedOffset = offset ? parseInt(offset, 10) : 0;
      const parsedSortOrder = sortOrder || 'DESC';

      const result = await this.liveNetworkForkService.getRecords(
        parsedStartDate,
        parsedEndDate,
        parsedNetworks,
        parsedContractNames,
        parsedLimit,
        parsedOffset,
        sortBy,
        parsedSortOrder,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get live benchmark records: ${error.message}`);
    }
  }

  @Delete('records/timestamp/:timestamp')
  @ApiOperation({
    summary: 'Delete live benchmark records by timestamp',
    description: 'Deletes all live benchmark records for a specific timestamp',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Records deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            deletedCount: { type: 'number' },
          },
        },
      },
    },
  })
  async deleteRecordsByTimestamp(@Param('timestamp') timestamp: string) {
    try {
      const deletedCount = await this.liveNetworkForkService.deleteByTimestamp(timestamp);
      return {
        success: true,
        message: `Deleted ${deletedCount} live benchmark records`,
        data: {
          deletedCount,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to delete live benchmark records: ${error.message}`);
    }
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export live benchmark data to CSV',
    description: 'Exports live benchmark data to CSV format with optional filtering',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (ISO string)' })
  @ApiQuery({ name: 'networks', required: false, type: String, description: 'Comma-separated network names' })
  @ApiQuery({ name: 'contractNames', required: false, type: String, description: 'Comma-separated contract names' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CSV file generated and downloaded successfully',
  })
  async exportToCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('networks') networks?: string,
    @Query('contractNames') contractNames?: string,
    @Res() res?: Response,
  ) {
    try {
      const exportResult = await this.liveNetworkForkService.exportToCsv();

      if (res) {
        // Read the CSV file content
        const csvContent = fs.readFileSync(exportResult.filePath, 'utf8');
        
        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8').toString());
        
        // Send the file content
        res.send(csvContent);
        
        // Clean up the temporary file
        fs.unlink(exportResult.filePath, (err) => {
          if (err) console.error('Error deleting temporary file:', err);
        });
        
        return;
      }
        
      return {
        success: true,
        message: `Exported ${exportResult.recordCount} live network fork records`,
        data: {
          filename: exportResult.filename,
          recordCount: exportResult.recordCount,
        },
      };
    } catch (error) {
      throw new BadRequestException(`Failed to export live benchmark data: ${error.message}`);
    }
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get live benchmark statistics',
    description: 'Retrieves statistics about stored live benchmark data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics() {
    try {
      const stats = await this.liveNetworkForkService.getStatistics();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get statistics: ${error.message}`);
    }
  }
}