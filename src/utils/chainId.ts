import { ChainId } from "@juiceswapxyz/sdk-core";

export const getChainFieldByChainId = (chainId: number) => {
  switch (chainId) {
    case ChainId.CITREA_TESTNET:
      return 'CITREA_TESTNET';

    case 4114:
      return 'CITREA';
      
    default:
      return null;
  }
}