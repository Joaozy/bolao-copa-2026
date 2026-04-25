const instanceId = '3EFE17C88E90F221FACF06476D668174';
const token = '70A917B12D52258244973CC9';
const clientToken = 'Fa3556196a91b49388c1436ddd93f7ed1S'; // O token que você acabou de resgatar!
const telefoneDestino = '5579991159138'; // Seu número real aqui (com 55, DDD e o 9)

async function testar() {
    console.log('Enviando mensagem de teste...');
    try {
        const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Client-Token': clientToken
            },
            body: JSON.stringify({
                phone: telefoneDestino,
                message: "🏆 *TESTE DO BOLÃO* 🏆\n\nFala parceiro! Se você recebeu isso, a integração com a Z-API está 100% pronta para avisar os esquecidos!"
            })
        });
        
        const data = await response.json();
        console.log('Resposta da Z-API:', data);
    } catch (e) {
        console.error('Erro de rede:', e.message);
    }
}

testar();