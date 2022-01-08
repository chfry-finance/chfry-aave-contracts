import { getLendingPoolImpl } from '../../helpers/contracts-getters';
import { task } from 'hardhat/config';
import { getParamPerNetwork, insertContractAddressInDb } from '../../helpers/contracts-helpers';
import {
  deployATokenImplementations,
  deployATokensAndRatesHelper,
  deployLendingPool,
  deployLendingPoolConfigurator,
  deployStableAndVariableTokensHelper,
} from '../../helpers/contracts-deployments';
import { eContractid, eNetwork } from '../../helpers/types';
import { notFalsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import {
  getLendingPoolAddressesProvider,
  getLendingPool,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  loadPoolConfig,
  ConfigNames,
  getGenesisPoolAdmin,
  getEmergencyAdmin,
} from '../../helpers/configuration';

task('full:unpause', 'Deploy lending pool for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE: HardhatRuntimeEnvironment) => {
      await DRE.run('set-DRE');
      const poolConfig = loadPoolConfig(pool);
      const addressesProvider = await getLendingPoolAddressesProvider();
      console.log('addressesProvider:', addressesProvider.address);

      // Set lending pool conf impl to Address Provider
      console.log('before addressesProvider.getLendingPoolConfigurator:', await addressesProvider.getLendingPoolConfigurator())

      const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
        await addressesProvider.getLendingPoolConfigurator()
      );

      const admin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));

      // Pause market during deployment
      console.log('setPoolPause to false');
      await waitForTx(await lendingPoolConfiguratorProxy.connect(admin).setPoolPause(false));
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
 * **/
