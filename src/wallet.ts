import dotenv from 'dotenv';

import * as anchor from '@project-serum/anchor';

dotenv.config();

export function getSecretFromEnv() {
	const secret = process.env.SOLANA_SECRET_KEY || "";
	if (secret === "") {
		throw new Error("missing variable 'SOLANA_SECRET_KEY'");
	}
	return secret;
}

/**
 * browser wallet memic
 * */
export class Wallet {
	static fromSecretKey(secretKey: string): Wallet {
		return new Wallet(anchor.web3.Keypair.fromSecretKey(anchor.utils.bytes.bs58.decode(secretKey)));
	}

	constructor(private keypair: anchor.web3.Keypair) {}

	get publicKey(): anchor.web3.PublicKey {
		return this.keypair.publicKey;
	}

	signTransaction = async (tx: anchor.web3.Transaction) => {
		tx.partialSign(this.keypair);
		return tx;
	};

	signAllTransactions = async (txs: anchor.web3.Transaction[]) => {
		const promises = txs.map(async (tx) => await this.signTransaction(tx));
		return Promise.all(promises);
	};
}