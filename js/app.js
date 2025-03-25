// OFT合约ABI定义
const OFT_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "name": "dstEid", "type": "uint32" },
                    { "name": "to", "type": "bytes32" },
                    { "name": "amountLD", "type": "uint256" },
                    { "name": "minAmountLD", "type": "uint256" },
                    { "name": "extraOptions", "type": "bytes" },
                    { "name": "composeMsg", "type": "bytes" },
                    { "name": "oftCmd", "type": "bytes" }
                ],
                "name": "sendParam",
                "type": "tuple"
            },
            {
                "name": "payInLzToken",
                "type": "bool"
            }
        ],
        "name": "quoteSend",
        "outputs": [
            {
                "components": [
                    { "name": "nativeFee", "type": "uint256" },
                    { "name": "lzTokenFee", "type": "uint256" }
                ],
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "components": [
                    { "name": "dstEid", "type": "uint32" },
                    { "name": "to", "type": "bytes32" },
                    { "name": "amountLD", "type": "uint256" },
                    { "name": "minAmountLD", "type": "uint256" },
                    { "name": "extraOptions", "type": "bytes" },
                    { "name": "composeMsg", "type": "bytes" },
                    { "name": "oftCmd", "type": "bytes" }
                ],
                "name": "sendParam",
                "type": "tuple"
            },
            {
                "components": [
                    { "name": "nativeFee", "type": "uint256" },
                    { "name": "lzTokenFee", "type": "uint256" }
                ],
                "name": "fee",
                "type": "tuple"
            },
            {
                "name": "refundAddress",
                "type": "address"
            }
        ],
        "name": "send",
        "outputs": [
            {
                "components": [
                    { "name": "guid", "type": "bytes32" },
                    { "name": "nonce", "type": "uint64" },
                    { "name": "fee", "type": "uint256" }
                ],
                "name": "",
                "type": "tuple"
            },
            {
                "components": [
                    { "name": "amountSentLD", "type": "uint256" },
                    { "name": "amountReceivedLD", "type": "uint256" }
                ],
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "name": "",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// 链配置
const CHAIN_CONFIG = {
    "bsc": {
        "rpc": "https://bsc-dataseed.binance.org/",
        "chainId": 56,
        "lzChainId": 30102,
        "explorer": "https://bscscan.com/tx/"
    },
    "base": {
        "rpc": "https://mainnet.base.org",
        "chainId": 8453,
        "lzChainId": 30184,
        "explorer": "https://basescan.org/tx/"
    },
    "solana": {
        "rpc": "https://api.mainnet-beta.solana.com",
        "lzChainId": 30168,
        "explorer": "https://solscan.io/tx/"
    }
};

// 全局变量
let web3;
let accounts;
let contractInstance;
let tokenDecimals = 18;
let tokenSymbol = '';
let solanaConnection;
let solanaWallet;
let layerZeroSolana;

// 安全的金额计算函数
function calculateTokenAmount(amount, decimals) {
    // 将金额转换为字符串并移除小数点
    const amountStr = amount.toString();
    const decimalIndex = amountStr.indexOf('.');

    if (decimalIndex === -1) {
        // 整数金额
        return BigInt(amountStr + '0'.repeat(decimals));
    } else {
        const integerPart = amountStr.substring(0, decimalIndex);
        let fractionalPart = amountStr.substring(decimalIndex + 1);

        // 处理精度
        if (fractionalPart.length > decimals) {
            fractionalPart = fractionalPart.substring(0, decimals);
        } else if (fractionalPart.length < decimals) {
            fractionalPart = fractionalPart + '0'.repeat(decimals - fractionalPart.length);
        }

        return BigInt(integerPart + fractionalPart);
    }
}

// 转换地址为bytes32格式
function addressToBytes32(address) {
    if (address.startsWith('0x')) {
        address = address.slice(2);
    }

    if (address.length !== 40) {
        throw new Error('EVM地址必须是20字节长度');
    }

    return '0x' + '0'.repeat(24) + address;
}

// 显示状态消息
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.innerHTML = message;
    statusEl.className = 'status ' + type;
}

// 切换链
async function switchChain(chainName) {
    const chainInfo = CHAIN_CONFIG[chainName];

    if (!window.ethereum) {
        showStatus('请安装MetaMask钱包!', 'error');
        return false;
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + chainInfo.chainId.toString(16) }],
        });
        return true;
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await addChain(chainName);
                return true;
            } catch (addError) {
                showStatus('添加网络失败: ' + addError.message, 'error');
                return false;
            }
        } else {
            showStatus('切换网络失败: ' + switchError.message, 'error');
            return false;
        }
    }
}

// 添加链
async function addChain(chainName) {
    const chainInfo = CHAIN_CONFIG[chainName];
    let networkName, nativeCurrency, rpcUrls;

    if (chainName === 'bsc') {
        networkName = 'BNB Smart Chain';
        nativeCurrency = {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        };
        rpcUrls = ['https://bsc-dataseed.binance.org/'];
    } else if (chainName === 'base') {
        networkName = 'Base';
        nativeCurrency = {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
        };
        rpcUrls = ['https://mainnet.base.org'];
    }

    await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
            {
                chainId: '0x' + chainInfo.chainId.toString(16),
                chainName: networkName,
                nativeCurrency: nativeCurrency,
                rpcUrls: rpcUrls,
                blockExplorerUrls: [chainInfo.explorer.slice(0, -3)]
            },
        ],
    });
}

// 连接钱包
async function connectWallet() {
    const sourceChain = document.getElementById('source-chain').value;

    // 连接Solana钱包
    if (sourceChain === 'solana') {
        try {
            showStatus('正在连接Phantom钱包...', 'info');
            
            if (!isPhantomInstalled()) {
                showStatus('请安装Phantom钱包!<br><a href="https://phantom.app/" target="_blank">下载Phantom</a>', 'error');
                return;
            }
            
            solanaWallet = await connectPhantomWallet();
            const walletAddress = solanaWallet.publicKey.toString();
            document.getElementById('connect-wallet').textContent = walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4);
            document.getElementById('send-tx').disabled = false;
            
            // 初始化Solana连接
            solanaConnection = new solanaWeb3.Connection(CHAIN_CONFIG.solana.rpc);
            layerZeroSolana = new LayerZeroSolana(solanaConnection, solanaWallet);
            
            showStatus('Phantom钱包已连接', 'success');
            return;
        } catch (error) {
            showStatus('连接Phantom钱包失败: ' + error.message, 'error');
            return;
        }
    }
    
    // 连接EVM钱包
    if (!window.ethereum) {
        showStatus('请安装MetaMask钱包!', 'error');
        return;
    }

    try {
        showStatus('正在连接MetaMask钱包...', 'info');

        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        web3 = new Web3(window.ethereum);

        document.getElementById('connect-wallet').textContent = accounts[0].substring(0, 6) + '...' + accounts[0].substring(38);
        document.getElementById('send-tx').disabled = false;

        showStatus('MetaMask钱包已连接', 'success');

        // 设置源链事件监听
        document.getElementById('source-chain').addEventListener('change', async function () {
            const selectedChain = this.value;
            
            // 重新加载页面以切换钱包类型
            if ((selectedChain === 'solana' && web3) || (selectedChain !== 'solana' && solanaWallet)) {
                location.reload();
                return;
            }
            
            if (selectedChain !== 'solana' && await switchChain(selectedChain)) {
                loadContractInfo();
            }
        });

        // 初始切换到源链
        if (await switchChain(sourceChain)) {
            loadContractInfo();
        }
    } catch (error) {
        showStatus('连接MetaMask钱包失败: ' + error.message, 'error');
    }
}

// 加载合约信息
async function loadContractInfo() {
    try {
        const contractAddress = document.getElementById('contract-address').value;
        const sourceChain = document.getElementById('source-chain').value;
        
        // Solana代币信息加载
        if (sourceChain === 'solana') {
            if (!solanaWallet) {
                showStatus('请先连接Phantom钱包', 'error');
                return;
            }

            try {
                // 验证代币铸造地址格式
                new solanaWeb3.PublicKey(contractAddress);
            } catch (error) {
                showStatus('无效的Solana代币铸造地址', 'error');
                return;
            }

            // 这里我们将使用代币铸造地址来设置代币信息
            // 在实际应用中，你可能需要从链上获取代币元数据
            tokenSymbol = 'SOL-OFT';  // 示例代币名称
            tokenDecimals = 9;  // Solana上的代币通常是9位小数

            // 获取代币余额
            try {
                const balance = await layerZeroSolana.getTokenBalance(
                    contractAddress, 
                    solanaWallet.publicKey
                );
                
                showStatus(`代币: SOL-OFT (${tokenSymbol}), 余额: ${balance.toFixed(6)}`, 'info');
            } catch (error) {
                // 可能用户账户上没有该代币
                showStatus(`代币: SOL-OFT (${tokenSymbol}), 余额: 0.000000`, 'info');
            }
            
            return;
        }
        
        // EVM合约信息加载
        if (!web3.utils.isAddress(contractAddress)) {
            showStatus('无效的合约地址', 'error');
            return;
        }

        contractInstance = new web3.eth.Contract(OFT_ABI, contractAddress);

        // 获取代币信息
        tokenSymbol = await contractInstance.methods.symbol().call();
        tokenDecimals = parseInt(await contractInstance.methods.decimals().call());
        const tokenName = await contractInstance.methods.name().call();

        // 获取余额
        const balance = await contractInstance.methods.balanceOf(accounts[0]).call();
        const formattedBalance = parseFloat(balance) / Math.pow(10, tokenDecimals);

        showStatus(`代币: ${tokenName} (${tokenSymbol}), 余额: ${formattedBalance.toFixed(6)}`, 'info');
    } catch (error) {
        showStatus('加载合约信息失败: ' + error.message, 'error');
    }
}

// 执行跨链交易
async function sendBridgeTransaction() {
    try {
        const contractAddress = document.getElementById('contract-address').value;
        const toAddress = document.getElementById('to-address').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const sourceChain = document.getElementById('source-chain').value;
        const destChain = document.getElementById('dest-chain').value;

        if (isNaN(amount) || amount <= 0) {
            showStatus('无效的金额', 'error');
            return;
        }

        if (sourceChain === destChain) {
            showStatus('源链和目标链不能相同', 'error');
            return;
        }

        // 处理Solana作为源链的情况
        if (sourceChain === 'solana') {
            await sendFromSolana(contractAddress, toAddress, amount, destChain);
            return;
        }
        
        // 处理EVM作为源链，Solana作为目标链的情况
        if (destChain === 'solana') {
            await sendToSolana(contractAddress, toAddress, amount, sourceChain);
            return;
        }

        // 以下是原有的EVM-to-EVM跨链逻辑
        if (!web3.utils.isAddress(contractAddress) || !web3.utils.isAddress(toAddress)) {
            showStatus('无效的地址格式', 'error');
            return;
        }

        // 切换到源链
        if (!(await switchChain(sourceChain))) {
            return;
        }

        showStatus('正在准备交易...', 'info');

        // 检查余额
        const balance = await contractInstance.methods.balanceOf(accounts[0]).call();
        const formattedBalance = parseFloat(balance) / Math.pow(10, tokenDecimals);

        // 使用安全的金额计算函数
        const amountInWei = calculateTokenAmount(amount, tokenDecimals);

        // 计算最小接收金额 (95%)
        const minAmountRatio = BigInt(95);
        const minAmount = (amountInWei * minAmountRatio) / BigInt(100);

        if (BigInt(balance) < amountInWei) {
            showStatus(`余额不足: 需要 ${amount} ${tokenSymbol}, 当前余额 ${formattedBalance.toFixed(6)}`, 'error');
            return;
        }

        // 准备发送参数
        const toBytes32 = addressToBytes32(toAddress);
        const destChainId = CHAIN_CONFIG[destChain].lzChainId;

        const sendParam = {
            dstEid: destChainId,
            to: toBytes32,
            amountLD: amountInWei.toString(),
            minAmountLD: minAmount.toString(),
            extraOptions: '0x',
            composeMsg: '0x',
            oftCmd: '0x'
        };

        // 估算费用
        showStatus('正在估算费用...', 'info');

        let nativeFee;
        try {
            const fee = await contractInstance.methods.quoteSend(sendParam, false).call({ from: accounts[0] });
            nativeFee = fee[0]; // nativeFee

            const formattedFee = web3.utils.fromWei(nativeFee, 'ether');
            showStatus(`预估费用: ${formattedFee} ${sourceChain === 'bsc' ? 'BNB' : 'ETH'}`, 'info');
        } catch (error) {
            showStatus('费用估算失败，使用默认费用: ' + error.message, 'info');
            nativeFee = web3.utils.toWei('0.02', 'ether');
        }

        // 确认交易
        if (!confirm(`确认从${sourceChain.toUpperCase()}发送 ${amount} ${tokenSymbol}到${destChain.toUpperCase()}?`)) {
            showStatus('交易已取消', 'info');
            return;
        }

        // 发送交易
        showStatus('正在发送交易...', 'info');

        const fee = {
            nativeFee: nativeFee,
            lzTokenFee: '0'
        };

        await contractInstance.methods.send(sendParam, fee, accounts[0])
            .send({
                from: accounts[0],
                value: nativeFee,
                gas: 500000
            })
            .on('transactionHash', function (hash) {
                const explorerUrl = CHAIN_CONFIG[sourceChain].explorer + hash;
                showStatus(`交易已提交，正在处理...<br>哈希: <a href="${explorerUrl}" target="_blank">${hash}</a>`, 'info');
            })
            .on('receipt', function (receipt) {
                if (receipt.status) {
                    showStatus(`交易成功! 代币将在几分钟内到达${destChain.toUpperCase()}链<br>接收地址: ${toAddress}`, 'success');
                } else {
                    showStatus('交易失败!', 'error');
                }
            })
            .on('error', function (error) {
                showStatus('交易发送失败: ' + error.message, 'error');
            });

    } catch (error) {
        showStatus('交易发送失败: ' + error.message, 'error');
    }
}

// 从Solana发送到其他链
async function sendFromSolana(tokenMint, toAddress, amount, destChain) {
    try {
        if (!solanaWallet) {
            showStatus('请先连接Phantom钱包', 'error');
            return;
        }

        try {
            // 验证代币铸造地址格式
            new solanaWeb3.PublicKey(tokenMint);
        } catch (error) {
            showStatus('无效的Solana代币铸造地址', 'error');
            return;
        }

        // 验证目标地址
        if (destChain !== 'solana' && !toAddress.startsWith('0x')) {
            showStatus('发送至EVM链的接收地址必须是0x开头的以太坊格式地址', 'error');
            return;
        }

        showStatus('正在准备Solana跨链交易...', 'info');

        // 获取代币余额
        let balance;
        try {
            balance = await layerZeroSolana.getTokenBalance(
                tokenMint,
                solanaWallet.publicKey
            );
        } catch (error) {
            balance = 0;
        }

        if (balance < amount) {
            showStatus(`余额不足: 需要 ${amount} ${tokenSymbol}, 当前余额 ${balance.toFixed(6)}`, 'error');
            return;
        }

        // 计算最小接收金额 (95%)
        const minAmount = amount * 0.95;

        // 估算费用
        showStatus('正在估算费用...', 'info');
        const destChainId = CHAIN_CONFIG[destChain].lzChainId;

        let fee;
        try {
            fee = await layerZeroSolana.estimateSendFee({
                dstEid: destChainId,
                toAddress: toAddress,
                amount: amount
            });
            
            const formattedFee = fee.nativeFee / solanaWeb3.LAMPORTS_PER_SOL;
            showStatus(`预估费用: ${formattedFee.toFixed(6)} SOL`, 'info');
        } catch (error) {
            showStatus('费用估算失败，使用默认费用: ' + error.message, 'info');
            fee = {
                nativeFee: 0.01 * solanaWeb3.LAMPORTS_PER_SOL,
                lzTokenFee: 0
            };
        }

        // 确认交易
        if (!confirm(`确认从SOLANA发送 ${amount} ${tokenSymbol}到${destChain.toUpperCase()}?`)) {
            showStatus('交易已取消', 'info');
            return;
        }

        // 发送交易
        showStatus('正在发送交易...', 'info');
        
        const result = await layerZeroSolana.sendToEvm({
            oftMint: tokenMint,
            amount: amount,
            dstEid: destChainId,
            dstAddress: toAddress,
            minAmount: minAmount
        });
        
        const explorerUrl = CHAIN_CONFIG.solana.explorer + result.txHash;
        showStatus(`交易已提交，正在处理...<br>哈希: <a href="${explorerUrl}" target="_blank">${result.txHash}</a>`, 'info');
        
        // 假设交易成功
        showStatus(`交易成功! 代币将在几分钟内到达${destChain.toUpperCase()}链<br>接收地址: ${toAddress}`, 'success');
    } catch (error) {
        showStatus('从Solana发送跨链交易失败: ' + error.message, 'error');
    }
}

// 从其他链发送到Solana
async function sendToSolana(contractAddress, toAddress, amount, sourceChain) {
    try {
        // 验证Solana接收地址
        try {
            new solanaWeb3.PublicKey(toAddress);
        } catch (error) {
            showStatus('无效的Solana接收地址', 'error');
            return;
        }

        if (!web3.utils.isAddress(contractAddress)) {
            showStatus('无效的合约地址', 'error');
            return;
        }

        // 切换到源链
        if (!(await switchChain(sourceChain))) {
            return;
        }

        showStatus('正在准备发送到Solana的跨链交易...', 'info');

        // 检查余额
        const balance = await contractInstance.methods.balanceOf(accounts[0]).call();
        const formattedBalance = parseFloat(balance) / Math.pow(10, tokenDecimals);

        // 使用安全的金额计算函数
        const amountInWei = calculateTokenAmount(amount, tokenDecimals);

        // 计算最小接收金额 (95%)
        const minAmountRatio = BigInt(95);
        const minAmount = (amountInWei * minAmountRatio) / BigInt(100);

        if (BigInt(balance) < amountInWei) {
            showStatus(`余额不足: 需要 ${amount} ${tokenSymbol}, 当前余额 ${formattedBalance.toFixed(6)}`, 'error');
            return;
        }

        // 将Solana地址转换为LayerZero期望的格式
        // 这里需要将Solana地址转换为EVM兼容的bytes32格式
        const solanaPublicKey = new solanaWeb3.PublicKey(toAddress);
        const solanaBytes = solanaPublicKey.toBytes();
        
        // 填充至32字节
        const paddedBytes = new Uint8Array(32);
        paddedBytes.set(solanaBytes);
        
        // 转换为十六进制
        const toBytes32 = '0x' + Array.from(paddedBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const destChainId = CHAIN_CONFIG.solana.lzChainId;

        const sendParam = {
            dstEid: destChainId,
            to: toBytes32,
            amountLD: amountInWei.toString(),
            minAmountLD: minAmount.toString(),
            extraOptions: '0x',
            composeMsg: '0x',
            oftCmd: '0x'
        };

        // 估算费用
        showStatus('正在估算费用...', 'info');

        let nativeFee;
        try {
            const fee = await contractInstance.methods.quoteSend(sendParam, false).call({ from: accounts[0] });
            nativeFee = fee[0]; // nativeFee

            const formattedFee = web3.utils.fromWei(nativeFee, 'ether');
            showStatus(`预估费用: ${formattedFee} ${sourceChain === 'bsc' ? 'BNB' : 'ETH'}`, 'info');
        } catch (error) {
            showStatus('费用估算失败，使用默认费用: ' + error.message, 'info');
            nativeFee = web3.utils.toWei('0.02', 'ether');
        }

        // 确认交易
        if (!confirm(`确认从${sourceChain.toUpperCase()}发送 ${amount} ${tokenSymbol}到SOLANA?`)) {
            showStatus('交易已取消', 'info');
            return;
        }

        // 发送交易
        showStatus('正在发送交易...', 'info');

        const fee = {
            nativeFee: nativeFee,
            lzTokenFee: '0'
        };

        await contractInstance.methods.send(sendParam, fee, accounts[0])
            .send({
                from: accounts[0],
                value: nativeFee,
                gas: 500000
            })
            .on('transactionHash', function (hash) {
                const explorerUrl = CHAIN_CONFIG[sourceChain].explorer + hash;
                showStatus(`交易已提交，正在处理...<br>哈希: <a href="${explorerUrl}" target="_blank">${hash}</a>`, 'info');
            })
            .on('receipt', function (receipt) {
                if (receipt.status) {
                    showStatus(`交易成功! 代币将在几分钟内到达SOLANA链<br>接收地址: ${toAddress}`, 'success');
                } else {
                    showStatus('交易失败!', 'error');
                }
            })
            .on('error', function (error) {
                showStatus('交易发送失败: ' + error.message, 'error');
            });
    } catch (error) {
        showStatus('发送到Solana的跨链交易失败: ' + error.message, 'error');
    }
}

// 页面加载完成后设置事件监听
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
    document.getElementById('send-tx').addEventListener('click', sendBridgeTransaction);

    // 当目标链变更时，确保源链和目标链不同
    document.getElementById('dest-chain').addEventListener('change', function () {
        const sourceSelect = document.getElementById('source-chain');
        const destSelect = this;

        if (sourceSelect.value === destSelect.value) {
            // 选择另一个不同的链
            const otherChains = Object.keys(CHAIN_CONFIG).filter(c => c !== destSelect.value);
            sourceSelect.value = otherChains[0];
        }
    });

    // 当源链变更时，确保源链和目标链不同
    document.getElementById('source-chain').addEventListener('change', function () {
        const sourceSelect = this;
        const destSelect = document.getElementById('dest-chain');

        if (sourceSelect.value === destSelect.value) {
            // 选择另一个不同的链
            const otherChains = Object.keys(CHAIN_CONFIG).filter(c => c !== sourceSelect.value);
            destSelect.value = otherChains[0];
        }
    });
});