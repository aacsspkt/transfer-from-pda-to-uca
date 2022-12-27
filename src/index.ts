import * as anchor from '@project-serum/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import {
  getSecretFromEnv,
  Wallet,
} from './wallet';

const IDL: anchor.Idl = {
	version: "0.1.0",
	name: "zebec",
	instructions: [
		{
			name: "depositToken",
			accounts: [
				{
					name: "zebecVault",
					isMut: true,
					isSigner: false,
				},
				{
					name: "sourceAccount",
					isMut: true,
					isSigner: true,
				},
				{
					name: "systemProgram",
					isMut: false,
					isSigner: false,
				},
				{
					name: "tokenProgram",
					isMut: false,
					isSigner: false,
				},
				{
					name: "associatedTokenProgram",
					isMut: false,
					isSigner: false,
				},
				{
					name: "rent",
					isMut: false,
					isSigner: false,
				},
				{
					name: "mint",
					isMut: false,
					isSigner: false,
				},
				{
					name: "sourceAccountTokenAccount",
					isMut: true,
					isSigner: false,
				},
				{
					name: "pdaAccountTokenAccount",
					isMut: true,
					isSigner: false,
				},
			],
			args: [
				{
					name: "amount",
					type: "u64",
				},
			],
		},
		{
			name: "instantTokenTransfer",
			accounts: [
				{
					name: "zebecVault",
					isMut: false,
					isSigner: false,
				},
				{
					name: "destAccount",
					isMut: true,
					isSigner: false,
				},
				{
					name: "sourceAccount",
					isMut: true,
					isSigner: true,
				},
				{
					name: "withdrawData",
					isMut: true,
					isSigner: false,
				},
				{
					name: "systemProgram",
					isMut: false,
					isSigner: false,
				},
				{
					name: "tokenProgram",
					isMut: false,
					isSigner: false,
				},
				{
					name: "associatedTokenProgram",
					isMut: false,
					isSigner: false,
				},
				{
					name: "rent",
					isMut: false,
					isSigner: false,
				},
				{
					name: "mint",
					isMut: false,
					isSigner: false,
				},
				{
					name: "pdaAccountTokenAccount",
					isMut: true,
					isSigner: false,
				},
				{
					name: "destTokenAccount",
					isMut: true,
					isSigner: false,
				},
			],
			args: [
				{
					name: "amount",
					type: "u64",
				},
			],
		},
	],
};

// type Zebec = typeof IDL;

// zebec program id
const programId = new anchor.web3.PublicKey("zbcKGdAmXfthXY3rEPBzexVByT2cqRqCZb9NwWdGQ2T");

const secretKey = getSecretFromEnv();
const wallet = Wallet.fromSecretKey(secretKey);

const connection = new anchor.web3.Connection(anchor.web3.clusterApiUrl("devnet"));

const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());

const zebecProgram = new anchor.Program(IDL, programId, provider);

function getZebecVaultSync(owner: anchor.web3.PublicKey): anchor.web3.PublicKey {
	return anchor.web3.PublicKey.findProgramAddressSync([owner.toBuffer()], programId)[0];
}

function getWithdrawDataSync(owner: anchor.web3.PublicKey, mint?: anchor.web3.PublicKey): anchor.web3.PublicKey {
	const seeds = [Buffer.from("withdraw_token"), owner.toBuffer()];
	mint && seeds.push(mint.toBuffer());
	return anchor.web3.PublicKey.findProgramAddressSync(seeds, programId)[0];
}

async function getDepositTokenTransaction(
	sourceAccount: anchor.web3.PublicKey,
	mint: anchor.web3.PublicKey,
	amount: anchor.BN,
): Promise<anchor.web3.Transaction> {
	const sourceAccountTokenAccount = getAssociatedTokenAddressSync(mint, sourceAccount, true);
	const zebecVault = getZebecVaultSync(sourceAccount);
	const pdaAccountTokenAccount = getAssociatedTokenAddressSync(mint, zebecVault, true);

	return zebecProgram.methods
		.depositToken(amount)
		.accounts({
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			mint,
			pdaAccountTokenAccount,
			rent: anchor.web3.SYSVAR_RENT_PUBKEY,
			sourceAccount,
			sourceAccountTokenAccount,
			systemProgram: anchor.web3.SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			zebecVault
		})
		.transaction();
}

async function getInstantTokenTransferTransaction(
	sourceAccount: anchor.web3.PublicKey,
	destAccount: anchor.web3.PublicKey,
	mint: anchor.web3.PublicKey,
	amount: anchor.BN,
): Promise<anchor.web3.Transaction> {
	const destTokenAccount = getAssociatedTokenAddressSync(mint, destAccount, true);
	const zebecVault = getZebecVaultSync(sourceAccount);
	const pdaAccountTokenAccount = getAssociatedTokenAddressSync(mint, zebecVault, true);
	const withdrawData = getWithdrawDataSync(sourceAccount, mint);

	return zebecProgram.methods
		.instantTokenTransfer(amount)
		.accounts({
			associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
			destAccount,
			destTokenAccount,
			mint,
			pdaAccountTokenAccount,
			rent: anchor.web3.SYSVAR_RENT_PUBKEY,
			sourceAccount,
			systemProgram: anchor.web3.SystemProgram.programId,
			tokenProgram: TOKEN_PROGRAM_ID,
			withdrawData,
			zebecVault,
		})
		.transaction();
}

const owner = wallet.publicKey;
// console.log("owner:", owner.toString());
const mint = new anchor.web3.PublicKey("AbLwGR8A1wvsiLWrzzA5eYPoQw51NVMcMMTPvAv5LTJ");
const destination = new anchor.web3.PublicKey("CSbNAhedp9JBjchyoPdBH4QWgmrncuhx6SwQxv4gdqhP");
const depositAmount = new anchor.BN("1000000000"); // = 1 token
const transferAmount = new anchor.BN("1000000000"); // = 1 token

async function deposit(): Promise<void> {
	const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

	const depositTransaction = await getDepositTokenTransaction(owner, mint, depositAmount);
	depositTransaction.recentBlockhash = blockhash;
	depositTransaction.lastValidBlockHeight = lastValidBlockHeight;
	depositTransaction.feePayer = owner;
	const sigedTransaction = await wallet.signTransaction(depositTransaction);

	const signature = await connection.sendRawTransaction(sigedTransaction.serialize());
	console.log("signature:", signature);
	await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
}

async function transferFromVault() {
	const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

	const transferTransaction = await getInstantTokenTransferTransaction(owner, destination, mint, transferAmount);
	transferTransaction.recentBlockhash = blockhash;
	transferTransaction.lastValidBlockHeight = lastValidBlockHeight;
	transferTransaction.feePayer = owner;
	const sigedTransaction = await wallet.signTransaction(transferTransaction);

	const signature = await connection.sendRawTransaction(sigedTransaction.serialize());
	console.log("signature:", signature);
	await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
}

deposit().then((_) => {
	transferFromVault();
});
