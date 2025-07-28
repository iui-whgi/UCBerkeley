class PaperReferenceTree {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.loading = document.getElementById('loading');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
        this.paperTitle = document.getElementById('paperTitle');
        this.paperDetails = document.getElementById('paperDetails');
        this.referenceTree = document.getElementById('referenceTree');
        
        this.maxDepth = 3; // 최대 트리 깊이
        this.cache = new Map(); // API 응답 캐시
        
        this.init();
    }

    init() {
        this.searchBtn.addEventListener('click', () => this.searchPaper());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchPaper();
            }
        });
    }

    async searchPaper() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showError('논문 제목을 입력해주세요.');
            return;
        }

        this.showLoading();
        this.hideError();
        this.hideResults();

        try {
            // Crossref API로 논문 검색
            const papers = await this.searchCrossref(query);
            
            if (papers.length === 0) {
                this.showError('검색 결과가 없습니다. 다른 키워드로 시도해보세요.');
                return;
            }

            // 첫 번째 결과 선택 (가장 관련성 높은 결과)
            const selectedPaper = papers[0];
            
            // 논문 정보 표시
            this.displayPaperInfo(selectedPaper);
            
            // 참고문헌 트리 생성
            await this.buildReferenceTree(selectedPaper.DOI, 0);
            
            this.showResults();
        } catch (error) {
            console.error('검색 오류:', error);
            this.showError('검색 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            this.hideLoading();
        }
    }

    async searchCrossref(query) {
        const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=5&select=DOI,title,author,published-print,container-title`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Crossref API 요청 실패');
        }
        
        const data = await response.json();
        return data.message.items || [];
    }

    displayPaperInfo(paper) {
        const title = paper.title?.[0] || '제목 없음';
        const authors = paper.author?.map(a => a.given + ' ' + a.family).join(', ') || '저자 정보 없음';
        const year = paper['published-print']?.[0]?.dateParts?.[0]?.[0] || '연도 정보 없음';
        const journal = paper['container-title']?.[0] || '저널 정보 없음';
        const doi = paper.DOI || 'DOI 없음';

        this.paperTitle.textContent = title;
        this.paperDetails.innerHTML = `
            <p><strong>저자:</strong> ${authors}</p>
            <p><strong>저널:</strong> ${journal}</p>
            <p><strong>연도:</strong> ${year}</p>
            <p><strong>DOI:</strong> <a href="https://doi.org/${doi}" target="_blank">${doi}</a></p>
        `;
    }

    async buildReferenceTree(doi, depth) {
        if (depth >= this.maxDepth) {
            return;
        }

        try {
            const references = await this.getReferences(doi);
            
            if (references.length === 0) {
                if (depth === 0) {
                    this.referenceTree.innerHTML = '<div class="no-references">참고문헌 정보를 찾을 수 없습니다.</div>';
                }
                return;
            }

            // 트리 노드 생성
            const treeContainer = document.createElement('div');
            
            for (const ref of references.slice(0, 10)) { // 최대 10개만 표시
                const node = this.createTreeNode(ref, depth);
                treeContainer.appendChild(node);
                
                // 재귀적으로 하위 참고문헌 검색 (깊이 제한)
                if (depth < this.maxDepth - 1 && ref.DOI) {
                    try {
                        const subReferences = await this.getReferences(ref.DOI);
                        if (subReferences.length > 0) {
                            const subTree = await this.buildReferenceTree(ref.DOI, depth + 1);
                            if (subTree) {
                                treeContainer.appendChild(subTree);
                            }
                        }
                    } catch (error) {
                        console.warn('하위 참고문헌 검색 실패:', error);
                    }
                }
            }

            if (depth === 0) {
                this.referenceTree.innerHTML = '';
                this.referenceTree.appendChild(treeContainer);
            }

            return treeContainer;
        } catch (error) {
            console.error('참고문헌 트리 생성 오류:', error);
            if (depth === 0) {
                this.referenceTree.innerHTML = '<div class="no-references">참고문헌 정보를 가져오는 중 오류가 발생했습니다.</div>';
            }
        }
    }

    async getReferences(doi) {
        // 캐시 확인
        if (this.cache.has(doi)) {
            return this.cache.get(doi);
        }

        const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('참고문헌 정보를 가져올 수 없습니다.');
        }
        
        const data = await response.json();
        const references = data.message.reference || [];
        
        // 캐시에 저장
        this.cache.set(doi, references);
        
        return references;
    }

    createTreeNode(reference, depth) {
        const node = document.createElement('div');
        node.className = `tree-node level-${depth}`;
        
        const title = reference['article-title'] || reference.title || '제목 없음';
        const authors = reference.author || '저자 정보 없음';
        const journal = reference['journal-title'] || reference['container-title'] || '저널 정보 없음';
        const year = reference.year || reference['published-print']?.[0]?.dateParts?.[0]?.[0] || '연도 정보 없음';
        const doi = reference.DOI || '';

        node.innerHTML = `
            <div class="node-title">${title}</div>
            <div class="node-authors">${authors}</div>
            <div class="node-journal">${journal}</div>
            <div class="node-year">${year}</div>
            ${doi ? `<div class="node-doi"><a href="https://doi.org/${doi}" target="_blank">DOI: ${doi}</a></div>` : ''}
        `;

        return node;
    }

    showLoading() {
        this.loading.style.display = 'block';
    }

    hideLoading() {
        this.loading.style.display = 'none';
    }

    showResults() {
        this.resultsSection.style.display = 'block';
    }

    hideResults() {
        this.resultsSection.style.display = 'none';
    }

    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.style.display = 'flex';
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    new PaperReferenceTree();
}); 