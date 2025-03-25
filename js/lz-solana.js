// LayerZero Solana SDK 简化版本
class LayerZeroSolana {
    constructor(connection, wallet) {
        this.connection = connection;
        this.wallet = wallet;
        this.programId = new solanaWeb3.PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');
        this.oftProgramId = new solanaWeb3.PublicKey('6doghB248px58JSSwG4qejQ46kFMW4AMj7vzJnWZHNZn');
    }

    // 获取OFT代币余额
    async getTokenBalance(tokenMint, owner) {
        try {
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                owner,
                { mint: new solanaWeb3.PublicKey(tokenMint) }
            );

            if (tokenAccounts.value.length === 0) {
                return 0;
            }

            return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        } catch (error) {
            console.error('获取代币余额失败:', error);
            throw error;
        }
    }

    // 计算估算费用
    async estimateSendFee(params) {
        try {
            const { dstEid, toAddress, amount, gasLimit, msgValue } = params;
            
            // 在实际情况下，应该调用OFT程序的quote_send指令
            // 这里简化为返回固定费用
            console.log(`估算费用参数: 目标链ID=${dstEid}, 地址=${toAddress}, 金额=${amount}, Gas限制=${gasLimit}, 消息值=${msgValue}`);
            
            // 实际费用会随着gasLimit和msgValue变化
            // 这里简单模拟更高的gas参数会导致更高的费用
            let calculatedFee = 0.01;
            
            if (gasLimit && msgValue) {
                calculatedFee += (gasLimit / 10000000) + (msgValue / 100000000);
            }
            
            return {
                nativeFee: calculatedFee * solanaWeb3.LAMPORTS_PER_SOL,
                lzTokenFee: 0
            };
        } catch (error) {
            console.error('估算费用失败:', error);
            throw error;
        }
    }

    // 将EVM地址转换为Solana接收格式
    convertEvmAddressToSolanaFormat(evmAddress) {
        if (evmAddress.startsWith('0x')) {
            evmAddress = evmAddress.slice(2);
        }
        return Buffer.from(evmAddress.padStart(64, '0'), 'hex');
    }

    // 将Solana地址转换为EVM接收格式 (bytes32)
    convertSolanaAddressToEvmFormat(solanaAddress) {
        const addressBuffer = new solanaWeb3.PublicKey(solanaAddress).toBuffer();
        const addressHex = '0x' + Buffer.from(addressBuffer).toString('hex');
        return addressHex;
    }

    // 发送OFT跨链交易到EVM链
    async sendToEvm(params) {
        try {
            const {
                oftMint,            // OFT代币的Mint地址
                amount,             // 发送金额
                dstEid,             // 目标链ID
                dstAddress,         // 目标地址(EVM格式)
                minAmount,          // 最小接收金额
            } = params;

            // 找到OFT Store账户 (PDA)
            const [oftStoreAddress] = await solanaWeb3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from('oft_store'),
                    new solanaWeb3.PublicKey(oftMint).toBuffer()
                ],
                this.oftProgramId
            );

            // 找到关联代币账户 (Associated Token Account)
            const userTokenAccount = await this.findAssociatedTokenAddress(
                this.wallet.publicKey,
                new solanaWeb3.PublicKey(oftMint)
            );

            // 设置执行选项 - 重要！Solana跨链需要此配置
            const GAS_LIMIT = 200_000; // Gas (Compute Units in Solana) limit for the executor
            const MSG_VALUE = 2_000_000; // msg.value for the lzReceive() function on destination in lamports
            
            // 准备options数据
            const optionsData = new Uint8Array([
                1, // 选项类型: 1表示ExecutorLzReceiveOption
                ...new Uint8Array(new Uint32Array([GAS_LIMIT]).buffer), // Gas限制(4字节)
                ...new Uint8Array(new Uint32Array([MSG_VALUE]).buffer)  // 消息值(4字节)
            ]);

            // 准备to地址 (EVM格式)
            let toBytes;
            if (dstAddress.startsWith('0x')) {
                const hexAddress = dstAddress.slice(2);
                toBytes = new Uint8Array(32);
                // 填充前面24个字节为0
                for (let i = 0; i < 24; i++) {
                    toBytes[i] = 0;
                }
                // 将后面8个字节(20字节地址)转换为字节数组
                for (let i = 0; i < 20; i++) {
                    toBytes[24 + i] = parseInt(hexAddress.substring(i * 2, i * 2 + 2), 16);
                }
            } else {
                throw new Error('EVM地址格式错误');
            }

            // 准备发送数据
            const amountInDecimals = amount * Math.pow(10, 9); // 假设9位小数
            const minAmountInDecimals = minAmount * Math.pow(10, 9);

            // 创建发送指令
            const instruction = new solanaWeb3.TransactionInstruction({
                keys: [
                    // 添加所需账户
                    { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
                    { pubkey: oftStoreAddress, isSigner: false, isWritable: true },
                    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: new solanaWeb3.PublicKey(oftMint), isSigner: false, isWritable: true },
                    { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: solanaWeb3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                ],
                programId: this.oftProgramId,
                data: Buffer.from([
                    1, // 指令类型: 1表示send
                    ...new Uint8Array(new Uint32Array([dstEid]).buffer), // 目标链ID(4字节)
                    ...toBytes, // 目标地址(32字节)
                    ...new Uint8Array(new BigUint64Array([BigInt(amountInDecimals)]).buffer), // 金额(8字节)
                    ...new Uint8Array(new BigUint64Array([BigInt(minAmountInDecimals)]).buffer), // 最小金额(8字节)
                    ...optionsData, // 执行选项
                ])
            });

            // 创建交易
            const transaction = new solanaWeb3.Transaction().add(instruction);
            
            // 设置最近的区块哈希和费用支付者
            transaction.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
            transaction.feePayer = this.wallet.publicKey;

            // 发送并确认交易
            const signature = await this.wallet.sendTransaction(transaction, this.connection);
            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
            
            if (confirmation.value.err) {
                throw new Error(`交易确认错误: ${confirmation.value.err}`);
            }
            
            return {
                signature,
                txHash: signature
            };
        } catch (error) {
            console.error('发送OFT失败:', error);
            throw error;
        }
    }

    // 查找关联代币账户
    async findAssociatedTokenAddress(walletAddress, tokenMintAddress) {
        return (await solanaWeb3.PublicKey.findProgramAddressSync(
            [
                walletAddress.toBuffer(),
                solanaWeb3.TOKEN_PROGRAM_ID.toBuffer(),
                tokenMintAddress.toBuffer(),
            ],
            new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
        ))[0];
    }

    // 接收OFT跨链交易 (从EVM链发送过来的)
    async receiveFromEvm(params) {
        try {
            // 实际上，这一步通常由Solana上的LayerZero端点自动处理
            // 用户不需要手动调用接收函数
            return {
                success: true,
                message: '跨链传输正在进行中，代币将自动到达...'
            };
        } catch (error) {
            console.error('接收OFT失败:', error);
            throw error;
        }
    }
}

// 辅助函数: 检查是否安装了Phantom钱包
function isPhantomInstalled() {
    const provider = window.phantom?.solana;
    return provider?.isPhantom;
}

// 辅助函数: 连接到Phantom钱包
async function connectPhantomWallet() {
    try {
        const provider = window.phantom?.solana;
        
        if (!provider?.isPhantom) {
            throw new Error('Phantom钱包未安装');
        }
        
        const response = await provider.connect();
        return {
            publicKey: response.publicKey,
            signTransaction: async (transaction) => {
                const signedTransaction = await provider.signTransaction(transaction);
                return signedTransaction;
            },
            signAllTransactions: async (transactions) => {
                const signedTransactions = await provider.signAllTransactions(transactions);
                return signedTransactions;
            },
            sendTransaction: async (transaction, connection, options = {}) => {
                const {signature} = await provider.signAndSendTransaction(transaction, options);
                return signature;
            }
        };
    } catch (error) {
        console.error('连接Phantom钱包失败:', error);
        throw error;
    }
} 