// LayerZero Solana SDK 简化版本
class LayerZeroSolana {
    constructor(connection, wallet) {
        this.connection = connection;
        this.wallet = wallet;
        this.programId = new solanaWeb3.PublicKey('LZ1111111111111111111111111111111111111111');
        this.oftProgramId = new solanaWeb3.PublicKey('ooooooo1111111111111111111111111111111111');
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
            // 这里是费用估算的简化实现
            // 实际上，你需要调用LayerZero Solana程序来获取费用
            return {
                nativeFee: 0.01 * solanaWeb3.LAMPORTS_PER_SOL, // 0.01 SOL作为示例
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

            // 构造交易逻辑 (简化版)
            // 在实际实现中，您需要创建合适的指令调用LayerZero Solana程序
            
            // 创建一个示例交易
            const transaction = new solanaWeb3.Transaction().add(
                // 这里是调用OFT程序的指令
                // 实际实现需要按照LayerZero Solana OFT文档来构造指令
                solanaWeb3.SystemProgram.transfer({
                    fromPubkey: this.wallet.publicKey,
                    toPubkey: this.oftProgramId,
                    lamports: 0.01 * solanaWeb3.LAMPORTS_PER_SOL
                })
            );

            // 发送并确认交易
            const signature = await this.wallet.sendTransaction(transaction, this.connection);
            await this.connection.confirmTransaction(signature, 'confirmed');
            
            return {
                signature,
                txHash: signature
            };
        } catch (error) {
            console.error('发送OFT失败:', error);
            throw error;
        }
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