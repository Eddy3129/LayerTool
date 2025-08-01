import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { GasAnalysisController } from './controllers/gas-analysis.controller';
import { NetworkComparisonController } from './controllers/network-comparison.controller';
import { LiveNetworkForkerController } from './controllers/live-network-forker.controller';

// Services
import { GasAnalysisService } from './services/gas-analysis.service';
import { ContractCompilationService } from './services/contract-compilation.service';
import { GasEstimationService } from './services/gas-estimation.service';
import { ForkingService } from './services/forking.service';
import { LiveNetworkForkerService } from './services/live-network-forker.service';
import { NetworkAnalysisService } from './services/network-analysis.service';
import { BytecodeAnalysisService } from './services/bytecode-analysis.service';
import { NetworkComparisonService } from './services/network-comparison.service';
import { BlobCostAnalysisService } from './services/blob-cost-analysis.service';
import { DataStorageService } from '../../shared/data-storage.service';
import { CsvExportService } from '../../shared/csv-export.service';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    ConfigModule,
    SharedModule,
  ],
  controllers: [
    GasAnalysisController,
    NetworkComparisonController,
    LiveNetworkForkerController,
  ],
  providers: [
    DataStorageService,
    CsvExportService,
    GasAnalysisService,
    ContractCompilationService,
    GasEstimationService,
    ForkingService,
    LiveNetworkForkerService,
    NetworkAnalysisService,
    BytecodeAnalysisService,
    NetworkComparisonService,
    BlobCostAnalysisService,
  ],
  exports: [
    DataStorageService,
    CsvExportService,
    GasAnalysisService,
    ContractCompilationService,
    GasEstimationService,
    ForkingService,
    LiveNetworkForkerService,
    NetworkAnalysisService,
    BytecodeAnalysisService,
    NetworkComparisonService,
    BlobCostAnalysisService,
  ],
})
export class GasAnalysisModule {}