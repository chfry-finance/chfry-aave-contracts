import { task } from 'hardhat/config';
import {
  loadPoolConfig,
  ConfigNames,
  getTreasuryAddress,
  getWrappedNativeTokenAddress,
} from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAaveProtocolDataProvider,
  getAddressById,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolAddressesProviderRegistry,
  getLendingPoolCollateralManager,
  getLendingPoolCollateralManagerImpl,
  getLendingPoolConfiguratorImpl,
  getLendingPoolConfiguratorProxy,
  getLendingPoolImpl,
  getProxy,
  getWalletProvider,
  getWETHGateway,
} from '../../helpers/contracts-getters';
import { verifyContract, getParamPerNetwork } from '../../helpers/contracts-helpers';
import { notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import { eContractid, eNetwork, ICommonConfiguration } from '../../helpers/types';

task('verify:general', 'Verify contracts at Etherscan')
  .addFlag('all', 'Verify all contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ all, pool }, localDRE) => {
    await localDRE.run('set-DRE');
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const {
      ReserveAssets,
      ReservesConfig,
      ProviderRegistry,
      MarketId,
      LendingPoolCollateralManager,
      LendingPoolConfigurator,
      LendingPool,
      WethGateway,
    } = poolConfig as ICommonConfiguration;
    console.log('begin...'.green);
    const treasuryAddress = await getTreasuryAddress(poolConfig);

    const registryAddress = getParamPerNetwork(ProviderRegistry, network);
    const addressesProvider = await getLendingPoolAddressesProvider();
    const addressesProviderRegistry = notFalsyOrZeroAddress(registryAddress)
      ? await getLendingPoolAddressesProviderRegistry(registryAddress)
      : await getLendingPoolAddressesProviderRegistry();
    const lendingPoolAddress = await addressesProvider.getLendingPool();
    const lendingPoolConfiguratorAddress = await addressesProvider.getLendingPoolConfigurator(); //getLendingPoolConfiguratorProxy();
    const lendingPoolCollateralManagerAddress =
      await addressesProvider.getLendingPoolCollateralManager();

    const lendingPoolProxy = await getProxy(lendingPoolAddress);
    const lendingPoolConfiguratorProxy = await getProxy(lendingPoolConfiguratorAddress);
    const lendingPoolCollateralManagerProxy = await getProxy(lendingPoolCollateralManagerAddress);

    if (all) {
      const lendingPoolImplAddress = getParamPerNetwork(LendingPool, network);
      const lendingPoolImpl = notFalsyOrZeroAddress(lendingPoolImplAddress)
        ? await getLendingPoolImpl(lendingPoolImplAddress)
        : await getLendingPoolImpl();

      const lendingPoolConfiguratorImplAddress = getParamPerNetwork(
        LendingPoolConfigurator,
        network
      );
      const lendingPoolConfiguratorImpl = notFalsyOrZeroAddress(lendingPoolConfiguratorImplAddress)
        ? await getLendingPoolConfiguratorImpl(lendingPoolConfiguratorImplAddress)
        : await getLendingPoolConfiguratorImpl();

      const lendingPoolCollateralManagerImplAddress = getParamPerNetwork(
        LendingPoolCollateralManager,
        network
      );
      const lendingPoolCollateralManagerImpl = notFalsyOrZeroAddress(
        lendingPoolCollateralManagerImplAddress
      )
        ? await getLendingPoolCollateralManagerImpl(lendingPoolCollateralManagerImplAddress)
        : await getLendingPoolCollateralManagerImpl();

      const dataProvider = await getAaveProtocolDataProvider();
      const walletProvider = await getWalletProvider();

      const wethGatewayAddress = getParamPerNetwork(WethGateway, network);
      const wethGateway = notFalsyOrZeroAddress(wethGatewayAddress)
        ? await getWETHGateway(wethGatewayAddress)
        : await getWETHGateway();

      /*
    // Address Provider
    console.log('\n- Verifying address provider...\n'.green);
    await verifyContract(eContractid.LendingPoolAddressesProvider, addressesProvider, [MarketId]);

    // Address Provider Registry
    console.log('\n- Verifying address provider registry...\n'.green);
    await verifyContract(
      eContractid.LendingPoolAddressesProviderRegistry,
      addressesProviderRegistry,
      []
    );
    */

      // Lending Pool implementation
      console.log('\n- Verifying LendingPool Implementation...\n'.green);
      await verifyContract(eContractid.LendingPool, lendingPoolImpl, []);
      return

      // Lending Pool Configurator implementation
      console.log('\n- Verifying LendingPool Configurator Implementation...\n'.green);
      await verifyContract(eContractid.LendingPoolConfigurator, lendingPoolConfiguratorImpl, []);

      // Lending Pool Collateral Manager implementation
      console.log('\n- Verifying LendingPool Collateral Manager Implementation...\n'.green);
      await verifyContract(
        eContractid.LendingPoolCollateralManager,
        lendingPoolCollateralManagerImpl,
        []
      );

      // Test helpers
      console.log('\n- Verifying  Aave  Provider Helpers...\n'.green);
      await verifyContract(eContractid.AaveProtocolDataProvider, dataProvider, [
        addressesProvider.address,
      ]);

      // Wallet balance provider
      console.log('\n- Verifying  Wallet Balance Provider...\n'.green);
      await verifyContract(eContractid.WalletBalanceProvider, walletProvider, []);

      // WETHGateway
      console.log('\n- Verifying  WETHGateway...\n'.green);
      await verifyContract(eContractid.WETHGateway, wethGateway, [
        await getWrappedNativeTokenAddress(poolConfig),
      ]);
    }
    // Lending Pool proxy
    console.log('\n- Verifying  Lending Pool Proxy...\n'.green);
    await verifyContract(eContractid.InitializableAdminUpgradeabilityProxy, lendingPoolProxy, [
      addressesProvider.address,
    ]);

    // LendingPool Conf proxy
    console.log('\n- Verifying  Lending Pool Configurator Proxy...\n'.green);
    await verifyContract(
      eContractid.InitializableAdminUpgradeabilityProxy,
      lendingPoolConfiguratorProxy,
      [addressesProvider.address]
    );

    // Proxy collateral manager
    console.log('\n- Verifying  Lending Pool Collateral Manager Proxy...\n'.green);
    await verifyContract(
      eContractid.InitializableAdminUpgradeabilityProxy,
      lendingPoolCollateralManagerProxy,
      []
    );

    console.log('Finished verifications.'.green);
  });
