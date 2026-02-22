import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class WalletLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'walletAddress must be a valid Ethereum address',
  })
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{130}$/, {
    message: 'signature must be a valid Ethereum signature',
  })
  signature: string;
}
