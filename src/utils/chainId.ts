export const getChainFieldByChainId = (chainId: number) => {
  switch (chainId) {
    case 4114:
      return 'CITREA';

    default:
      return null;
  }
}