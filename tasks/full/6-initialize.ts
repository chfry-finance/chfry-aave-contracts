import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployLendingPoolCollateralManager,
  deployWalletBalancerProvider,
  authorizeWETHGateway,
  deployUiPoolDataProviderV2,
} from '../../helpers/contracts-deployments';
import { loadPoolConfig, ConfigNames, getTreasuryAddress } from '../../helpers/configuration';
import { getWETHGateway } from '../../helpers/contracts-getters';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import { notFalsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import { initReservesByHelper, configureReservesByHelper } from '../../helpers/init-helpers';
import { exit } from 'process';
import {
  getAaveProtocolDataProvider,
  getLendingPoolAddressesProvider,
} from '../../helpers/contracts-getters';
import { chainlinkAggregatorProxy, chainlinkEthUsdAggregatorProxy } from '../../helpers/constants';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run('set-DRE');
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ATokenNamePrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
        SymbolPrefix,
        ReserveAssets,
        ReservesConfig,
        LendingPoolCollateralManager,
        WethGateway,
        IncentivesController,
      } = poolConfig as ICommonConfiguration;

      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const incentivesController = await getParamPerNetwork(IncentivesController, network);
      const addressesProvider = await getLendingPoolAddressesProvider();

      const testHelpers = await getAaveProtocolDataProvider();

      const admin = await addressesProvider.getPoolAdmin();
      const oracle = await addressesProvider.getPriceOracle();
      console.log('addressesProvider:', addressesProvider.address);
      console.log('testHelpers:', testHelpers.address);
      console.log('admin:', admin);
      console.log('oracle:', oracle);

      if (!reserveAssets) {
        throw 'Reserve assets is undefined. Check ReserveAssets configuration at config directory';
      }

      const treasuryAddress = await getTreasuryAddress(poolConfig);

      console.log('before initReservesByHelper');
      await initReservesByHelper(
        ReservesConfig,
        reserveAssets,
        ATokenNamePrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
        SymbolPrefix,
        admin,
        treasuryAddress,
        incentivesController,
        pool,
        verify
      );

      console.log('before configureReservesByHelper');
      await configureReservesByHelper(ReservesConfig, reserveAssets, testHelpers, admin);

      //TODO 添加不同资产的时候，执行到这里就可以了，后面不需要再执行了。
      // return

      let collateralManagerAddress = await getParamPerNetwork(
        LendingPoolCollateralManager,
        network
      );
      if (!notFalsyOrZeroAddress(collateralManagerAddress)) {
        const collateralManager = await deployLendingPoolCollateralManager(verify);
        collateralManagerAddress = collateralManager.address;
      }
      // Seems unnecessary to register the collateral manager in the JSON db

      console.log(
        '\tSetting lending pool collateral manager implementation with address',
        collateralManagerAddress
      );
      await waitForTx(
        await addressesProvider.setLendingPoolCollateralManager(collateralManagerAddress)
      );

      console.log(
        '\tSetting AaveProtocolDataProvider at AddressesProvider at id: 0x01',
        collateralManagerAddress
      );
      const aaveProtocolDataProvider = await getAaveProtocolDataProvider();
      await waitForTx(
        await addressesProvider.setAddress(
          '0x0100000000000000000000000000000000000000000000000000000000000000',
          aaveProtocolDataProvider.address
        )
      );

      await deployWalletBalancerProvider(verify);

      const uiPoolDataProvider = await deployUiPoolDataProviderV2(
        chainlinkAggregatorProxy[localBRE.network.name],
        chainlinkEthUsdAggregatorProxy[localBRE.network.name],
        verify
      );
      console.log('UiPoolDataProvider deployed at:', uiPoolDataProvider.address);

      const lendingPoolAddress = await addressesProvider.getLendingPool();

      let gateWay = getParamPerNetwork(WethGateway, network);
      if (!notFalsyOrZeroAddress(gateWay)) {
        gateWay = (await getWETHGateway()).address;
      }
      console.log('GATEWAY', gateWay);
      await authorizeWETHGateway(gateWay, lendingPoolAddress);
    } catch (err) {
      console.error(err);
      exit(1);
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
 * 4_data-provider
 * 1. 部署data provider，传入provider作为参数即可
 * 5-deploy-wethGateWay
 * 1. 部署weth gateway，包了一层
 * **/
