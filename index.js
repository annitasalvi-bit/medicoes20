const express = require('express');
const db = require('./db'); 
const app = express();
const port = 3000;


app.use(express.json());

/**
 * 3. Regras de Negócio e Cálculos

 */
function processarMedicao(tipo, valor) {
  const valorOrig = parseFloat(valor);
  let valorConvertido = 0;
  let unidadeOriginal = "";
  let unidadeConvertida = "";
  let classificacao = "";

  const tipoNormalizado = tipo.toLowerCase();

  // 3.1 Temperatura
  if (tipoNormalizado === 'temperatura') {
    unidadeOriginal = "°C";
    unidadeConvertida = "°F";
    valorConvertido = (valorOrig * 9 / 5) + 32;

    if (valorOrig < 10) {
      classificacao = "Frio";
    } else if (valorOrig >= 10 && valorOrig <= 25) {
      classificacao = "Agradável";
    } else {
      classificacao = "Quente";
    }
  } 
  // 3.2 Velocidade
  else if (tipoNormalizado === 'velocidade') {
    unidadeOriginal = "km/h";
    unidadeConvertida = "m/s";
    valorConvertido = valorOrig / 3.6;

    if (valorOrig < 40) {
      classificacao = "Baixa Velocidade";
    } else if (valorOrig >= 40 && valorOrig <= 90) {
      classificacao = "Velocidade Moderada";
    } else {
      classificacao = "Alta Velocidade";
    }
  } 
  // 3.3 Comprimento
  else if (tipoNormalizado === 'comprimento') {
    unidadeOriginal = "m";
    unidadeConvertida = "ft";
    valorConvertido = valorOrig * 3.28084;

    if (valorOrig < 5) {
      classificacao = "Curto";
    } else if (valorOrig >= 5 && valorOrig <= 50) {
      classificacao = "Médio";
    } else {
      classificacao = "Longo";
    }
  }

 // Todos os valores convertidos devem ser arredondados para 2 casas decimais.
  return {
    valor_original: valorOrig,
    unidade_original: unidadeOriginal,
    valor_convertido: parseFloat(valorConvertido.toFixed(2)),
    unidade_convertida: unidadeConvertida,
    classificacao: classificacao
  };
}




app.get('/', (req, res) => {
  res.status(200).send("API de Medições está operacional.");
});


app.get('/medicao', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM medicoes');
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ mensagem: "Erro interno do servidor", detalhes: error.message });
  }
});


app.get('/medicao/alta-velocidade', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM medicoes WHERE classificacao = "Alta Velocidade"');
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ mensagem: "Erro interno do servidor", detalhes: error.message });
  }
});


app.get('/medicao/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM medicoes WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ mensagem: "Medição não encontrada" });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ mensagem: "Erro interno do servidor", detalhes: error.message });
  }
});


app.post('/medicao', async (req, res) => {
  const { descricao, tipo, valor } = req.body;

  // 6. Validação de Campos Obrigatórios
  if (!descricao || !tipo || valor === undefined) {
    return res.status(400).json({ mensagem: "Verifique se todos os campos estão preenchidos" });
  }

  // 6. Validação de Tipo Inválido
  const tiposValidos = ['temperatura', 'velocidade', 'comprimento'];
  if (!tiposValidos.includes(tipo.toLowerCase())) {
    return res.status(400).json({ mensagem: "Tipo inválido. Escolha entre: temperatura, velocidade ou comprimento." });
  }

  // Executa os cálculos e a conversão de dados
  const resultado = processarMedicao(tipo, valor);

  try {
    const query = `
      INSERT INTO medicoes (descricao, tipo, valor_original, unidade_original, valor_convertido, unidade_convertida, classificacao) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
      descricao, 
      tipo, 
      resultado.valor_original, 
      resultado.unidade_original, 
      resultado.valor_convertido, 
      resultado.unidade_convertida, 
      resultado.classificacao
    ]);

    // Resposta exatamente igual à exigida na seção 7 da especificação
    res.status(201).json({
      id: result.insertId,
      descricao,
      tipo,
      valor_original: resultado.valor_original,
      unidade_original: resultado.unidade_original,
      valor_convertido: resultado.valor_convertido,
      unidade_convertida: resultado.unidade_convertida,
      classificacao: resultado.classificacao
    });
  } catch (error) {
    res.status(500).json({ mensagem: "Erro interno do servidor", detalhes: error.message });
  }
});


app.put('/medicao/:id', async (req, res) => {
  const { id } = req.params;
  const { descricao, tipo, valor } = req.body;

  // 6. Validação de Campos Obrigatórios
  if (!descricao || !tipo || valor === undefined) {
    return res.status(400).json({ mensagem: "Verifique se todos os campos estão preenchidos" });
  }

  // 6. Validação de Tipo Inválido
  const tiposValidos = ['temperatura', 'velocidade', 'comprimento'];
  if (!tiposValidos.includes(tipo.toLowerCase())) {
    return res.status(400).json({ mensagem: "Tipo inválido. Escolha entre: temperatura, velocidade ou comprimento." });
  }

  // Recalcula tudo com base nos novos valores recebidos no PUT
  const resultado = processarMedicao(tipo, valor);

  try {
    const query = `
      UPDATE medicoes 
      SET descricao = ?, tipo = ?, valor_original = ?, unidade_original = ?, valor_convertido = ?, unidade_convertida = ?, classificacao = ? 
      WHERE id = ?
    `;
    const [result] = await db.execute(query, [
      descricao, 
      tipo, 
      resultado.valor_original, 
      resultado.unidade_original, 
      resultado.valor_convertido, 
      resultado.unidade_convertida, 
      resultado.classificacao, 
      id
    ]);

    // 6. Registro Não Encontrado (Validando linhas afetadas no UPDATE)
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Medição não encontrada para atualização" });
    }

    res.status(200).json({
      id: Number(id),
      descricao,
      tipo,
      valor_original: resultado.valor_original,
      unidade_original: resultado.unidade_original,
      valor_convertido: resultado.valor_convertido,
      unidade_convertida: resultado.unidade_convertida,
      classificacao: resultado.classificacao
    });
  } catch (error) {
    res.status(500).json({ mensagem: "Erro interno do servidor", detalhes: error.message });
  }
});


app.delete('/medicao/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM medicoes WHERE id = ?', [id]);
    
    // 6. Registro Não Encontrado (Validando linhas afetadas no DELETE)
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: "Medição não encontrada" });
    }
    
    res.status(200).json({ mensagem: "Medição apagada com sucesso" });
  } catch (error) {
    res.status(500).json({ mensagem: "Erro interno do servidor", detalhes: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando com sucesso em http://localhost:${port}`);
});