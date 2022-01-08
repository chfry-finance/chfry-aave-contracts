import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployAaveOracle, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eNetwork, SymbolMap } from '../../helpers/types';
import { waitForTx, notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getGenesisPoolAdmin,
  getLendingRateOracles,
  getQuoteCurrency,
} from '../../helpers/configuration';
import {
  getAaveOracle,
  getLendingPoolAddressesProvider,
  getLendingRateOracle,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { AaveOracle, LendingRateOracle } from '../../types';

task('full:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run('set-DRE');
      const network = <eNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ProtocolGlobalParams: { UsdAddress },
        ReserveAssets,
        FallbackOracle,
        ChainlinkAggregator,
      } = poolConfig as ICommonConfiguration;
      const lendingRateOracles = getLendingRateOracles(poolConfig); //使用的common rate oracle common
      const addressesProvider = await getLendingPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const aaveOracleAddress = getParamPerNetwork(poolConfig.AaveOracle, network);
      const lendingRateOracleAddress = getParamPerNetwork(poolConfig.LendingRateOracle, network);
      const fallbackOracleAddress = await getParamPerNetwork(FallbackOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const chainlinkAggregators = await getParamPerNetwork(ChainlinkAggregator, network);

      const tokensToWatch: SymbolMap<string> = {
        ...reserveAssets,
        USD: UsdAddress,
      };
      console.log('tokensToWatch:', tokensToWatch);
      console.log('chainlinkAggregators:', chainlinkAggregators);
      
      //TODO 所有的chainlink价格在这里会聚到一起
      const [tokens, aggregators] = getPairsTokenAggregator(
        tokensToWatch,
        chainlinkAggregators,
        poolConfig.OracleQuoteCurrency
      );

      let aaveOracle: AaveOracle;
      let lendingRateOracle: LendingRateOracle;

      if (notFalsyOrZeroAddress(aaveOracleAddress)) {
        aaveOracle = await getAaveOracle(aaveOracleAddress);
        await waitForTx(await aaveOracle.setAssetSources(tokens, aggregators));
      } else {
        aaveOracle = await deployAaveOracle(
          [
            tokens,
            aggregators,
            fallbackOracleAddress,
            await getQuoteCurrency(poolConfig),
            poolConfig.OracleQuoteUnit,
          ],
          verify
        );
        await waitForTx(await aaveOracle.setAssetSources(tokens, aggregators));
      }

      if (notFalsyOrZeroAddress(lendingRateOracleAddress)) {
        lendingRateOracle = await getLendingRateOracle(lendingRateOracleAddress);
      } else {
        lendingRateOracle = await deployLendingRateOracle(verify);
        const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;
        await setInitialMarketRatesInRatesOracleByHelper(
          lendingRateOracles, //进该分支说明配置中 LendingRateOracle 字段为空，使用固定值
          tokensAddressesWithoutUsd,
          lendingRateOracle,
          admin
        );
      }

      console.log('Aave Oracle: %s', aaveOracle.address);
      console.log('Lending Rate Oracle: %s', lendingRateOracle.address);

      // Register the proxy price provider on the addressesProvider
      console.log('before addressesProvider.setPriceOracle:', await addressesProvider.getPriceOracle());
      await waitForTx(await addressesProvider.setPriceOracle(aaveOracle.address));

      console.log('before addressesProvider.setLendingRateOracle:', await addressesProvider.getLendingRateOracle());
      await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    } catch (error) {
      if (DRE.network.name.includes('tenderly')) {
        const transactionLink = `https://dashboard.tenderly.co/${DRE.config.tenderly.username}/${DRE.config.tenderly.project
          }/fork/${DRE.tenderly.network().getFork()}/simulation/${DRE.tenderly.network().getHead()}`;
        console.error('Check tx error:', transactionLink);
      }
      throw error;
    }
  });

/**
 * 1_address_provider
 * 1. 完成provider部署
 * 2. 如果需要部署registry，则会重新部署registry，同时注册到provider中
 * 3. 设置admain，使用部署账户的0地址
 * 2_lending_pool
 * 1. 部署lendingPool，执行initialize(provider)
 * 2. provider设置setLendingPoolImpl(lendingPool)
 * 3. 部署：poolConfig，deployLendingPoolConfigurator
 * 4. provider设置setLendingPoolConfiguratorImpl(poolConfig)
 * 5. 通过 poolConfig 暂停market市场
 * 部署两个helpers:
 * 6. deployStableAndVariableTokensHelper(lendingPoolProxy, addressesProvider)
 * 7. deployATokensAndRatesHelper(lendingPoolProxy, addressesProvider)
 * 8. deployATokenImplementations
 * 3_oracles
 * 1. 部署oracle：deployAaveOracle
 * 2. 向aaveOracle中设置token的价格数据：setAssetSources(tokens, aggregators)
 * (通过：getPairsTokenAggregator读取index.ts的)
 * 3. 部署deployLendingRateOracle，如果未配置地址，则重新部署，同时使用固定值common作为borrowRate
 * 4. 初始化：setInitialMarketRatesInRatesOracleByHelper()
 * 向provider中设置oracle
 * 5. addressesProvider.setPriceOracle()
 * 6. addressesProvider.setLendingRateOracle()
 * **/
